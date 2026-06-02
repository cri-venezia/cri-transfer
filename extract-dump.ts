import * as fs from 'fs';
import * as path from 'path';

const INPUT_FILE = path.resolve(__dirname, 'dump.json');
const OUTPUT_USERS = path.resolve(__dirname, 'supabase_profiles.json');
const OUTPUT_POSTS = path.resolve(__dirname, 'supabase_posts.json');

// Interfacce per la struttura di phpMyAdmin
interface TableExport {
    type: string;
    name: string;
    data: any[];
}

function cleanElementorGarbage(html: string): string {
    if (!html) return '';

    let cleaned = html;

    // 1. Rimuoviamo gli shortcode di Elementor (es. [elementor-template id="123"])
    const shortcodeRegex = new RegExp('\\[\\/?elementor[^\\]]*\\]', 'g');
    cleaned = cleaned.replace(shortcodeRegex, '');

    // 2. Rimuoviamo commenti HTML. Usiamo new RegExp per evitare bug di rendering visivo negli editor
    const htmlCommentRegex = new RegExp('', 'g');
    cleaned = cleaned.replace(htmlCommentRegex, '');

    // 3. Puliamo div vuoti o classi superflue di Elementor
    const elementorDivRegex = new RegExp('<div class="elementor[^>]*>', 'g');
    cleaned = cleaned.replace(elementorDivRegex, '<div>');

    return cleaned.trim();
}

async function processDump() {
    console.log('🚀 Lettura del dump JSON in corso (potrebbe richiedere qualche secondo)...');

    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ Errore: File ${INPUT_FILE} non trovato.`);
        return;
    }

    const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
    const dump: TableExport[] = JSON.parse(rawData);

    let usersExtracted = 0;
    let postsExtracted = 0;

    const supabaseProfiles = [];
    const supabasePosts = [];

    for (const block of dump) {
        if (block.type !== 'table' || !block.data) continue;

        // ESTRAZIONE UTENTI (Gestisce qualsiasi prefisso, es. wp_users o wp4732_users)
        if (block.name.endsWith('_users')) {
            console.log(`⏳ Trovata tabella utenti: ${block.name}`);

            for (const user of block.data) {
                supabaseProfiles.push({
                    email: user.user_email,
                    first_name: user.display_name?.split(' ')[0] || '',
                    last_name: user.display_name?.split(' ').slice(1).join(' ') || '',
                    role: 'volunteer',
                    created_at: user.user_registered
                });
                usersExtracted++;
            }
        }

        // ESTRAZIONE NEWS
        if (block.name.endsWith('_posts')) {
            console.log(`⏳ Trovata tabella post: ${block.name}`);

            for (const post of block.data) {
                // Filtriamo solo gli articoli del blog pubblicati
                if (post.post_type === 'post' && post.post_status === 'publish') {
                    supabasePosts.push({
                        wp_id: parseInt(post.ID),
                        title: post.post_title,
                        slug: post.post_name,
                        content: cleanElementorGarbage(post.post_content),
                        excerpt: cleanElementorGarbage(post.post_excerpt) || null,
                        published_at: post.post_date,
                        created_at: post.post_date,
                        status: 'published'
                    });
                    postsExtracted++;
                }
            }
        }
    }

    // Salvataggio dei risultati in locale
    fs.writeFileSync(OUTPUT_USERS, JSON.stringify(supabaseProfiles, null, 2));
    fs.writeFileSync(OUTPUT_POSTS, JSON.stringify(supabasePosts, null, 2));

    console.log('\n✅ Estrazione completata con successo!');
    console.log(`👤 Volontari/Admin estratti: ${usersExtracted} -> ${OUTPUT_USERS}`);
    console.log(`📰 News (pubblicate) estratte: ${postsExtracted} -> ${OUTPUT_POSTS}`);
}

processDump();