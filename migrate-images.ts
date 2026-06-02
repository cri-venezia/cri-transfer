import 'dotenv/config'; // Carica in automatico le variabili dal file .env
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// VALIDAZIONE VARIABILI D'AMBIENTE
// ==========================================
const WP_URL = process.env.WP_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'media';

if (!WP_URL || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Errore critico: Variabili d\'ambiente mancanti.');
    console.error('Assicurati di aver creato il file .env con WP_URL, SUPABASE_URL e SUPABASE_SERVICE_KEY.');
    process.exit(1);
}

// Inizializza il client Supabase con privilegi di amministratore
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrateImages() {
    console.log('🚀 Avvio migrazione delle immagini da WordPress a Supabase (Modalità Sicura)...');

    let page = 1;
    let totalPages = 1;
    let uploadedCount = 0;

    try {
        do {
            console.log(`\n📡 Recupero pagina ${page} dell'archivio media WP...`);

            // Chiamata all'API nativa di WordPress per i media
            const response = await axios.get(`${WP_URL}/wp-json/wp/v2/media`, {
                params: {
                    per_page: 50,
                    page: page
                }
            });

            if (page === 1) {
                totalPages = parseInt(response.headers['x-wp-totalpages'] || '1', 10);
            }

            const mediaItems = response.data;

            for (const item of mediaItems) {
                const sourceUrl = item.source_url;
                // Estraiamo il nome del file originale dall'URL
                const fileName = sourceUrl.split('/').pop() || `image-${item.id}.jpg`;
                const mimeType = item.mime_type;

                console.log(`⏳ Download in corso: ${fileName}...`);

                try {
                    // 1. Scarichiamo l'immagine da WordPress in formato ArrayBuffer
                    const imageResponse = await axios.get(sourceUrl, { responseType: 'arraybuffer' });
                    const buffer = Buffer.from(imageResponse.data, 'binary');

                    // 2. Carichiamo l'immagine nel bucket Supabase
                    const { data, error } = await supabase.storage
                        .from(BUCKET_NAME)
                        .upload(fileName, buffer, {
                            contentType: mimeType,
                            upsert: true // Sovrascrive se esiste già un file con lo stesso nome
                        });

                    if (error) {
                        console.error(`❌ Errore caricamento Supabase per ${fileName}:`, error.message);
                    } else {
                        console.log(`✅ Caricata con successo: ${fileName}`);
                        uploadedCount++;
                    }
                } catch (downloadError: any) {
                    console.error(`❌ Errore download da WordPress per ${fileName}:`, downloadError.message);
                }
            }

            page++;
        } while (page <= totalPages);

        console.log(`\n🎉 Migrazione completata! Immagini trasferite su Supabase: ${uploadedCount}`);

    } catch (error: any) {
        console.error('❌ Errore irreversibile durante la migrazione:', error.message);
    }
}

migrateImages();