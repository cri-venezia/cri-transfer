#!/bin/bash

# ==========================================
# DEFINIZIONE COLORI (Tema CRI)
# ==========================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ==========================================
# HEADER
# ==========================================
clear
echo -e "${RED}${BOLD}======================================================${NC}"
echo -e "${RED}${BOLD}    CROCE ROSSA ITALIANA - COMITATO DI VENEZIA        ${NC}"
echo -e "${RED}${BOLD}    Assistente di Migrazione Dati                     ${NC}"
echo -e "${RED}${BOLD}======================================================${NC}"
echo -e "${CYAN}Benvenuto. Questo tool ti guiderà passo passo nell'esportazione${NC}"
echo -e "${CYAN}dei dati dal vecchio sito verso la nuova piattaforma.${NC}\n"

# ==========================================
# CONTROLLO REQUISITI
# ==========================================
echo -e "${YELLOW}Controllo dei requisiti di sistema in corso...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js non trovato. Scaricalo e installalo da https://nodejs.org/${NC}"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npm/npx non trovati. Verifica l'installazione di Node.js.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Requisiti di sistema soddisfatti (Node.js installato).${NC}\n"

# ==========================================
# MENU INTERATTIVO
# ==========================================
show_menu() {
    echo -e "${BOLD}Seleziona un'operazione:${NC}"
    echo -e "  ${GREEN}1)${NC} Configura le credenziali di sicurezza"
    echo -e "  ${GREEN}2)${NC} Estrai Utenti e News dal Database"
    echo -e "  ${GREEN}3)${NC} Trasferisci le Immagini"
    echo -e "  ${GREEN}4)${NC} Esci"
    echo ""
    read -p "Inserisci il numero dell'operazione (1-4): " choice
}

# ==========================================
# LOGICA DELLE FUNZIONI
# ==========================================
setup_env() {
    clear
    echo -e "${YELLOW}${BOLD}--- Configurazione Credenziali ---${NC}"
    echo "Questi dati servono per connettersi in modo sicuro al nuovo database."
    echo ""

    read -p "Inserisci l'URL del vecchio sito (es. https://www.crivenezia.it): " wp_url
    read -p "Inserisci l'URL di Supabase (es. https://tuoprogetto.supabase.co): " supabase_url
    read -p "Inserisci la SERVICE ROLE KEY di Supabase: " supabase_key

    # Crea o sovrascrive il file .env
    cat <<EOF > .env
WP_URL=$wp_url
SUPABASE_URL=$supabase_url
SUPABASE_SERVICE_KEY=$supabase_key
EOF

    echo -e "\n${GREEN}✅ File .env generato con successo! Le credenziali sono salvate.${NC}\n"
}

extract_data() {
    clear
    echo -e "${YELLOW}${BOLD}--- Estrazione Utenti e News ---${NC}"

    if [ ! -f "dump.json" ]; then
        echo -e "${RED}❌ Errore: Il file 'dump.json' non è presente in questa cartella.${NC}"
        echo "Assicurati di aver inserito il file del database prima di procedere."
        echo ""
        return
    fi

    if [ ! -f "extract-dump.ts" ]; then
        echo -e "${RED}❌ Errore: Lo script 'extract-dump.ts' non è presente.${NC}"
        echo ""
        return
    fi

    echo -e "Avvio il motore di estrazione... Attendi.\n"
    # Lancia lo script tramite tsx
    npx tsx extract-dump.ts
    echo -e "\n${CYAN}Operazione completata. Ritorno al menu principale.${NC}\n"
}

migrate_images() {
    clear
    echo -e "${YELLOW}${BOLD}--- Trasferimento Immagini ---${NC}"

    if [ ! -f ".env" ]; then
        echo -e "${RED}❌ Errore: File .env non trovato.${NC}"
        echo "Esegui prima il passaggio 1 per configurare le credenziali."
        echo ""
        return
    fi

    if [ ! -f "migrate-images.ts" ]; then
        echo -e "${RED}❌ Errore: Lo script 'migrate-images.ts' non è presente.${NC}"
        echo ""
        return
    fi

    echo -e "Avvio il trasferimento delle immagini sul cloud... L'operazione potrebbe richiedere alcuni minuti.\n"
    # Lancia lo script tramite tsx
    npx tsx migrate-images.ts
    echo -e "\n${CYAN}Operazione completata. Ritorno al menu principale.${NC}\n"
}

# ==========================================
# LOOP PRINCIPALE
# ==========================================
while true; do
    show_menu
    case $choice in
        1) setup_env ;;
        2) extract_data ;;
        3) migrate_images ;;
        4)
            echo -e "\n${GREEN}Grazie per aver usato l'assistente. Arrivederci!${NC}"
            exit 0
            ;;
        *)
            clear
            echo -e "${RED}❌ Scelta non valida. Inserisci un numero da 1 a 4.${NC}\n"
            ;;
    esac
done