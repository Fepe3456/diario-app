/*
  storage.js
  ----------
  Questo file è il "magazzino dati" dell'app: tutte le funzioni che leggono
  o scrivono in localStorage vivono qui. Sia home.html che sezione.html
  lo includono con <script src="storage.js"></script>, così entrambe le
  pagine parlano con gli stessi dati, nello stesso modo.

  Due "tabelle" (in realtà due chiavi di localStorage, ognuna con un array
  di oggetti JSON):
  - diario_attivita  -> le attività (hanno una data, un orario opzionale)
  - diario_note      -> le note (semplice testo libero, senza data di scadenza)

  Ogni oggetto ha un campo "sezione" ('scuola' o 'personale') che ci
  permette di filtrare i dati corretti nella pagina sezione.html.
*/

const CHIAVE_ATTIVITA = 'diario_attivita';
const CHIAVE_NOTE = 'diario_note';

// Genera un id abbastanza unico senza librerie esterne
function generaId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function leggiTutte(chiave) {
  const grezzo = localStorage.getItem(chiave);
  if (!grezzo) return [];
  try {
    return JSON.parse(grezzo);
  } catch (errore) {
    console.error('Dati corrotti in', chiave, errore);
    return [];
  }
}

function scriviTutte(chiave, lista) {
  localStorage.setItem(chiave, JSON.stringify(lista));
}

/* ---------- ATTIVITÀ ---------- */

// Restituisce le attività di una sezione, ordinate per data (e ora)
function getAttivita(sezione) {
  return leggiTutte(CHIAVE_ATTIVITA)
    .filter(a => a.sezione === sezione)
    .sort((a, b) => (a.data + (a.ora || '')).localeCompare(b.data + (b.ora || '')));
}

function getAttivitaPerId(id) {
  return leggiTutte(CHIAVE_ATTIVITA).find(a => a.id === id) || null;
}

// Se l'oggetto ha già un id, aggiorna quella attività; altrimenti ne crea una nuova
function salvaAttivita(attivita) {
  const tutte = leggiTutte(CHIAVE_ATTIVITA);
  if (attivita.id) {
    const indice = tutte.findIndex(a => a.id === attivita.id);
    if (indice !== -1) {
      tutte[indice] = attivita;
      scriviTutte(CHIAVE_ATTIVITA, tutte);
      return attivita;
    }
  }
  attivita.id = generaId();
  tutte.push(attivita);
  scriviTutte(CHIAVE_ATTIVITA, tutte);
  return attivita;
}

function eliminaAttivita(id) {
  const tutte = leggiTutte(CHIAVE_ATTIVITA).filter(a => a.id !== id);
  scriviTutte(CHIAVE_ATTIVITA, tutte);
}

/* ---------- NOTE ---------- */

function getNote(sezione) {
  return leggiTutte(CHIAVE_NOTE)
    .filter(n => n.sezione === sezione)
    .sort((a, b) => b.dataCreazione.localeCompare(a.dataCreazione));
}

function getNotaPerId(id) {
  return leggiTutte(CHIAVE_NOTE).find(n => n.id === id) || null;
}

function salvaNota(nota) {
  const tutte = leggiTutte(CHIAVE_NOTE);
  if (nota.id) {
    const indice = tutte.findIndex(n => n.id === nota.id);
    if (indice !== -1) {
      tutte[indice] = nota;
      scriviTutte(CHIAVE_NOTE, tutte);
      return nota;
    }
  }
  nota.id = generaId();
  nota.dataCreazione = new Date().toISOString();
  tutte.push(nota);
  scriviTutte(CHIAVE_NOTE, tutte);
  return nota;
}

function eliminaNota(id) {
  const tutte = leggiTutte(CHIAVE_NOTE).filter(n => n.id !== id);
  scriviTutte(CHIAVE_NOTE, tutte);
}
