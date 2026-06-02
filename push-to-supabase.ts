import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carichiamo le variabili dal file .env
dotenv.config();

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Errore: Configura SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nel file .env');
    process.exit(1);
}

// Inizializziamo il client Supabase con la chiave Service Role (bypassa RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const currentDir = process.cwd();
const INPUT_USERS = path.resolve(currentDir, 'supabase_profiles.json');
const INPUT_POSTS = path.resolve(currentDir, 'supabase_posts.json');

async function migrateData() {
    console.log('🚀 Avvio migrazione dati su Supabase...');

    // ----------------------------------------------------
    // FASE 1: MIGRAZIONE UTENTI (AUTH + PROFILES)
    // ----------------------------------------------------
    let authorUuid: string | null = null;

    if (fs.existsSync(INPUT_USERS)) {
        const rawUsers = fs.readFileSync(INPUT_USERS, 'utf-8');
        const users = JSON.parse(rawUsers);
        console.log(`👤 Trovati ${users.length} utenti da migrare.`);

        for (const user of users) {
            console.log(`Generazione account per: ${user.email}`);

            // Creiamo l'utente nel modulo Auth di Supabase
            // Generiamo una password temporanea casuale; gli utenti useranno il reset password al lancio
            const tempPassword = Math.random().toString(36).slice(-12) + 'CriVe!';

            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                email: user.email,
                password: tempPassword,
                email_confirm: true, // Evitiamo l'invio della mail di conferma durante l'importazione
                user_metadata: {
                    first_name: user.first_name,
                    last_name: user.last_name
                }
            });

            if (authError) {
                if (authError.message.includes('already exists')) {
                    console.log(`ℹ️ L'utente ${user.email} esiste già su Supabase Auth. Recupero l'ID...`);
                    const { data: existingUsers } = await supabase.auth.admin.listUsers();
                    const found = existingUsers.users.find(u => u.email === user.email);
                    if (found) authorUuid = found.id;
                } else {
                    console.error(`❌ Errore creazione Auth per ${user.email}:`, authError.message);
                }
            } else if (authUser?.user) {
                authorUuid = authUser.user.id;

                // Aggiorniamo la tabella pubblica profiles
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: authorUuid,
                        email: user.email,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        role: 'admin' // Impostiamo come admin gli utenti storici estratti
                    });

                if (profileError) {
                    console.error(`❌ Errore inserimento profilo per ${user.email}:`, profileError.message);
                } else {
                    console.log(`✅ Utente e profilo allineati: ${user.email}`);
                }
            }
        }
    }

    // ----------------------------------------------------
    // FASE 2: MIGRAZIONE POSTS (ARTICOLI)
    // ----------------------------------------------------
    if (fs.existsSync(INPUT_POSTS)) {
        const rawPosts = fs.readFileSync(INPUT_POSTS, 'utf-8');
        const posts = JSON.parse(rawPosts);
        console.log(`\n📰 Trovati ${posts.length} articoli da caricare.`);

        // Prepariamo i record assegnando l'author_id recuperato dalla Fase 1
        const postsToInsert = posts.map((post: any) => ({
            wp_id: post.wp_id,
            title: post.title,
            slug: post.slug,
            content: post.content,
            excerpt: post.excerpt,
            featured_image_url: post.featured_image_url,
            status: post.status,
            published_at: post.published_at,
            created_at: post.created_at,
            author_id: authorUuid // Collega l'articolo all'ultimo admin creato o recuperato
        }));

        console.log('Scrittura articoli sul database...');

        // Eseguiamo un inserimento bulk (in blocco) sfruttando upsert sul vincolo wp_id
        const { error: postsError } = await supabase
            .from('posts')
            .upsert(postsToInsert, { onConflict: 'wp_id' });

        if (postsError) {
            console.error('❌ Errore durante il caricamento degli articoli:', postsError.message);
        } else {
            console.log(`🎉 Migrazione completata! ${postsToInsert.length} articoli caricati correttamente.`);
        }
    } else {
        console.log('⚠️ Nessun file degli articoli trovato. Salto la fase 2.');
    }
}

migrateData();