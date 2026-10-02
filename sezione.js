/*
  sezione.js
  ----------
  Gestisce tutta la pagina sezione.html: capire quale sezione mostrare,
  passare tra Attività/Note, passare tra elenco/calendario, e aprire i
  post-it per vedere/modificare/creare attività e note.

  Le funzioni di lettura/scrittura dati (getAttivita, salvaAttivita, ecc.)
  vengono da storage.js, incluso prima di questo file in sezione.html.
*/

/* ---------------------------------------------------------
   1. CAPIRE QUALE SEZIONE SIAMO ("scuola" o "personale")
   Leggiamo il parametro dall'URL, es: sezione.html?nome=scuola
   --------------------------------------------------------- */
const parametri = new URLSearchParams(window.location.search);
const sezioneCorrente = parametri.get('nome') === 'personale' ? 'personale' : 'scuola';

const NOMI_SEZIONE = { scuola: 'Scuola', personale: 'Personale' };

document.body.classList.add(sezioneCorrente === 'scuola' ? 'tema-scuola' : 'tema-personale');
document.getElementById('nome-sezione-titolo').textContent = NOMI_SEZIONE[sezioneCorrente];

/* ---------------------------------------------------------
   2. SOTTO-TAB: Attività <-> Note
   --------------------------------------------------------- */
const tabAttivita = document.getElementById('tab-attivita');
const tabNote = document.getElementById('tab-note');
const pannelloAttivita = document.getElementById('pannello-attivita');
const pannelloNote = document.getElementById('pannello-note');

tabAttivita.addEventListener('click', () => mostraSottoTab('attivita'));
tabNote.addEventListener('click', () => mostraSottoTab('note'));

function mostraSottoTab(nome) {
  const inAttivita = nome === 'attivita';
  tabAttivita.classList.toggle('attivo', inAttivita);
  tabNote.classList.toggle('attivo', !inAttivita);
  pannelloAttivita.hidden = !inAttivita;
  pannelloNote.hidden = inAttivita;
  if (inAttivita) {
    renderElencoAttivita();
  } else {
    renderElencoNote();
  }
}

/* ---------------------------------------------------------
   3. SELETTORE VISTA ATTIVITÀ: elenco <-> calendario
   --------------------------------------------------------- */
const btnVistaElenco = document.getElementById('btn-vista-elenco');
const btnVistaCalendario = document.getElementById('btn-vista-calendario');
const vistaElencoAttivita = document.getElementById('vista-elenco-attivita');
const vistaCalendarioAttivita = document.getElementById('vista-calendario-attivita');

btnVistaElenco.addEventListener('click', () => mostraVistaAttivita('elenco'));
btnVistaCalendario.addEventListener('click', () => mostraVistaAttivita('calendario'));

function mostraVistaAttivita(nome) {
  const inElenco = nome === 'elenco';
  btnVistaElenco.classList.toggle('attivo', inElenco);
  btnVistaCalendario.classList.toggle('attivo', !inElenco);
  vistaElencoAttivita.hidden = !inElenco;
  vistaCalendarioAttivita.hidden = inElenco;
  if (inElenco) {
    renderElencoAttivita();
  } else {
    renderCalendario();
  }
}

/* ---------------------------------------------------------
   4. HELPER PER LE DATE
   --------------------------------------------------------- */
function oggiISO() {
  return new Date().toISOString().slice(0, 10); // "2026-09-23"
}

function formattaDataBreve(dataISO) {
  const d = new Date(dataISO + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function formattaDataLunga(dataISO) {
  const d = new Date(dataISO + 'T00:00:00');
  const testo = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

/* ---------------------------------------------------------
   5. RENDER: ELENCO ATTIVITÀ
   --------------------------------------------------------- */
function renderElencoAttivita() {
  const attivita = getAttivita(sezioneCorrente);
  vistaElencoAttivita.innerHTML = '';

  if (attivita.length === 0) {
    vistaElencoAttivita.innerHTML = '<p class="messaggio-vuoto">Nessuna attività. Creane una con "+ Nuova attività".</p>';
    return;
  }

  attivita.forEach(a => {
    const riga = document.createElement('div');
    riga.className = 'riga-elemento';
    riga.tabIndex = 0;
    riga.setAttribute('role', 'button');
    riga.innerHTML = `
      <span class="data-riga">${formattaDataBreve(a.data)}</span>
      <span class="titolo-riga">${escapeHtml(a.titolo)}</span>
      <span class="estratto-riga">${a.ora || ''}</span>
      <span class="azioni-riga">
        <button class="icona-azione" data-azione="modifica" aria-label="Modifica attività" title="Modifica">✏️</button>
        <button class="icona-azione" data-azione="elimina" aria-label="Elimina attività" title="Elimina">🗑️</button>
      </span>
    `;

    // Click sui due pulsantini: agiscono subito, senza aprire il post-it
    riga.querySelector('[data-azione="modifica"]').addEventListener('click', (evento) => {
      evento.stopPropagation();
      apriModaleAttivitaModificaDiretta(a.id);
    });
    riga.querySelector('[data-azione="elimina"]').addEventListener('click', (evento) => {
      evento.stopPropagation();
      if (!confirm('Eliminare questa attività?')) return;
      eliminaAttivita(a.id);
      renderElencoAttivita();
    });

    // Click sul resto della riga: apre il post-it in sola visualizzazione
    riga.addEventListener('click', () => apriModaleAttivitaVisualizza(a.id));
    riga.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        apriModaleAttivitaVisualizza(a.id);
      }
    });

    vistaElencoAttivita.appendChild(riga);
  });
}

/* ---------------------------------------------------------
   6. RENDER: VISTA CALENDARIO
   --------------------------------------------------------- */
let meseCorrente = new Date().getMonth();
let annoCorrente = new Date().getFullYear();

document.getElementById('mese-precedente').addEventListener('click', () => cambiaMese(-1));
document.getElementById('mese-successivo').addEventListener('click', () => cambiaMese(1));

function cambiaMese(delta) {
  meseCorrente += delta;
  if (meseCorrente < 0) { meseCorrente = 11; annoCorrente--; }
  if (meseCorrente > 11) { meseCorrente = 0; annoCorrente++; }
  renderCalendario();
}

function giorniNelMese(anno, mese) {
  return new Date(anno, mese + 1, 0).getDate();
}

function primoGiornoSettimana(anno, mese) {
  const giorno = new Date(anno, mese, 1).getDay(); // 0 = domenica
  return giorno === 0 ? 6 : giorno - 1; // 0 = lunedì ... 6 = domenica
}

function renderCalendario() {
  const etichetta = new Date(annoCorrente, meseCorrente, 1)
    .toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  document.getElementById('etichetta-mese').textContent =
    etichetta.charAt(0).toUpperCase() + etichetta.slice(1);

  const griglia = document.getElementById('griglia-calendario');
  griglia.innerHTML = '';

  const attivitaDelMese = getAttivita(sezioneCorrente);
  const celleVuote = primoGiornoSettimana(annoCorrente, meseCorrente);
  const totaleGiorni = giorniNelMese(annoCorrente, meseCorrente);

  for (let i = 0; i < celleVuote; i++) {
    const vuota = document.createElement('div');
    vuota.className = 'cella-giorno vuota';
    griglia.appendChild(vuota);
  }

  for (let giorno = 1; giorno <= totaleGiorni; giorno++) {
    const meseStr = String(meseCorrente + 1).padStart(2, '0');
    const giornoStr = String(giorno).padStart(2, '0');
    const dataISO = `${annoCorrente}-${meseStr}-${giornoStr}`;

    const cella = document.createElement('div');
    cella.className = 'cella-giorno';

    const numero = document.createElement('span');
    numero.className = 'numero-giorno';
    numero.textContent = giorno;
    cella.appendChild(numero);

    attivitaDelMese
      .filter(a => a.data === dataISO)
      .forEach(a => {
        const chip = document.createElement('button');
        chip.className = 'chip-attivita';
        chip.textContent = a.titolo;
        chip.addEventListener('click', (evento) => {
          evento.stopPropagation(); // non deve attivare anche il click sulla cella
          apriModaleAttivitaVisualizza(a.id);
        });
        cella.appendChild(chip);
      });

    // Cliccando su una cella vuota (non su un chip) si crea una nuova attività con quella data già scelta
    cella.addEventListener('click', () => apriNuovaAttivita(dataISO));

    griglia.appendChild(cella);
  }
}

/* ---------------------------------------------------------
   7. RENDER: ELENCO NOTE
   --------------------------------------------------------- */
function renderElencoNote() {
  const note = getNote(sezioneCorrente);
  const contenitore = document.getElementById('vista-elenco-note');
  contenitore.innerHTML = '';

  if (note.length === 0) {
    contenitore.innerHTML = '<p class="messaggio-vuoto">Nessuna nota. Creane una con "+ Nuova nota".</p>';
    return;
  }

  note.forEach(n => {
    const card = document.createElement('button');
    card.className = 'card-nota';
    card.innerHTML = `
      <span class="titolo-card-nota">${escapeHtml(n.titolo)}</span>
      <span class="anteprima-card-nota">${escapeHtml(n.contenuto)}</span>
    `;
    card.addEventListener('click', () => apriModaleNotaVisualizza(n.id));
    contenitore.appendChild(card);
  });
}

/* ---------------------------------------------------------
   8. MODALE ATTIVITÀ (post-it)
   --------------------------------------------------------- */
const sfondoModaleAttivita = document.getElementById('sfondo-modale-attivita');
const vistaDettaglioAttivita = document.getElementById('vista-dettaglio-attivita');
const formAttivita = document.getElementById('form-attivita');
const btnModificaAttivita = document.getElementById('btn-modifica-attivita');
const btnEliminaAttivita = document.getElementById('btn-elimina-attivita');

let idAttivitaCorrente = null; // null = stiamo creando una nuova attività

document.getElementById('btn-nuova-attivita').addEventListener('click', () => apriNuovaAttivita());
document.getElementById('btn-chiudi-attivita').addEventListener('click', chiudiModaleAttivita);
btnModificaAttivita.addEventListener('click', passaAModificaAttivita);
btnEliminaAttivita.addEventListener('click', eliminaAttivitaCorrenteEChiudi);
formAttivita.addEventListener('submit', salvaFormAttivita);

function apriModaleAttivitaVisualizza(id) {
  const dati = getAttivitaPerId(id);
  if (!dati) return;
  idAttivitaCorrente = id;

  document.getElementById('dettaglio-attivita-titolo').textContent = dati.titolo;
  document.getElementById('dettaglio-attivita-data').textContent = formattaDataLunga(dati.data);

  const rigaOra = document.getElementById('riga-dettaglio-ora');
  rigaOra.hidden = !dati.ora;
  document.getElementById('dettaglio-attivita-ora').textContent = dati.ora || '';

  document.getElementById('dettaglio-attivita-note').textContent = dati.note || '—';

  vistaDettaglioAttivita.hidden = false;
  formAttivita.hidden = true;
  btnModificaAttivita.hidden = false;

  sfondoModaleAttivita.hidden = false;
}

function passaAModificaAttivita() {
  const dati = getAttivitaPerId(idAttivitaCorrente);
  if (!dati) return;

  document.getElementById('form-attivita-intestazione').textContent = 'Modifica attività';
  document.getElementById('input-attivita-titolo').value = dati.titolo;
  document.getElementById('input-attivita-data').value = dati.data;
  document.getElementById('input-attivita-ora').value = dati.ora || '';
  document.getElementById('input-attivita-note').value = dati.note || '';

  vistaDettaglioAttivita.hidden = true;
  formAttivita.hidden = false;
  btnModificaAttivita.hidden = true;
  btnEliminaAttivita.hidden = false;
}

// Usata dal pulsante ✏️ nella riga: apre il post-it già pronto per la modifica,
// saltando il passaggio di sola visualizzazione
function apriModaleAttivitaModificaDiretta(id) {
  idAttivitaCorrente = id;
  sfondoModaleAttivita.hidden = false;
  passaAModificaAttivita();
}

function apriNuovaAttivita(dataPreimpostata) {
  idAttivitaCorrente = null;

  document.getElementById('form-attivita-intestazione').textContent = 'Nuova attività';
  document.getElementById('input-attivita-titolo').value = '';
  document.getElementById('input-attivita-data').value = dataPreimpostata || oggiISO();
  document.getElementById('input-attivita-ora').value = '';
  document.getElementById('input-attivita-note').value = '';

  vistaDettaglioAttivita.hidden = true;
  formAttivita.hidden = false;
  btnModificaAttivita.hidden = true;
  btnEliminaAttivita.hidden = true;

  sfondoModaleAttivita.hidden = false;
}

function salvaFormAttivita(evento) {
  evento.preventDefault();

  const attivita = {
    id: idAttivitaCorrente,
    sezione: sezioneCorrente,
    titolo: document.getElementById('input-attivita-titolo').value.trim(),
    data: document.getElementById('input-attivita-data').value,
    ora: document.getElementById('input-attivita-ora').value,
    note: document.getElementById('input-attivita-note').value.trim()
  };

  if (!attivita.titolo || !attivita.data) return; // il browser già blocca grazie a "required"

  salvaAttivita(attivita);
  chiudiModaleAttivita();
  aggiornaVistaAttivitaCorrente();
}

function eliminaAttivitaCorrenteEChiudi() {
  if (!idAttivitaCorrente) return;
  if (!confirm('Eliminare questa attività?')) return;
  eliminaAttivita(idAttivitaCorrente);
  chiudiModaleAttivita();
  aggiornaVistaAttivitaCorrente();
}

function chiudiModaleAttivita() {
  sfondoModaleAttivita.hidden = true;
  idAttivitaCorrente = null;
}

function aggiornaVistaAttivitaCorrente() {
  // Dopo aver salvato/eliminato, ridisegniamo qualunque vista sia attiva ora
  if (vistaCalendarioAttivita.hidden) {
    renderElencoAttivita();
  } else {
    renderCalendario();
  }
}

/* ---------------------------------------------------------
   9. MODALE NOTA (post-it)
   --------------------------------------------------------- */
const sfondoModaleNota = document.getElementById('sfondo-modale-nota');
const vistaDettaglioNota = document.getElementById('vista-dettaglio-nota');
const formNota = document.getElementById('form-nota');
const btnModificaNota = document.getElementById('btn-modifica-nota');
const btnEliminaNota = document.getElementById('btn-elimina-nota');

let idNotaCorrente = null;

document.getElementById('btn-nuova-nota').addEventListener('click', () => apriNuovaNota());
document.getElementById('btn-chiudi-nota').addEventListener('click', chiudiModaleNota);
btnModificaNota.addEventListener('click', passaAModificaNota);
btnEliminaNota.addEventListener('click', eliminaNotaCorrenteEChiudi);
formNota.addEventListener('submit', salvaFormNota);

function apriModaleNotaVisualizza(id) {
  const dati = getNotaPerId(id);
  if (!dati) return;
  idNotaCorrente = id;

  document.getElementById('dettaglio-nota-titolo').textContent = dati.titolo;
  document.getElementById('dettaglio-nota-contenuto').textContent = dati.contenuto;

  vistaDettaglioNota.hidden = false;
  formNota.hidden = true;
  btnModificaNota.hidden = false;

  sfondoModaleNota.hidden = false;
}

function passaAModificaNota() {
  const dati = getNotaPerId(idNotaCorrente);
  if (!dati) return;

  document.getElementById('form-nota-intestazione').textContent = 'Modifica nota';
  document.getElementById('input-nota-titolo').value = dati.titolo;
  document.getElementById('input-nota-contenuto').value = dati.contenuto;

  vistaDettaglioNota.hidden = true;
  formNota.hidden = false;
  btnModificaNota.hidden = true;
  btnEliminaNota.hidden = false;
}

function apriNuovaNota() {
  idNotaCorrente = null;

  document.getElementById('form-nota-intestazione').textContent = 'Nuova nota';
  document.getElementById('input-nota-titolo').value = '';
  document.getElementById('input-nota-contenuto').value = '';

  vistaDettaglioNota.hidden = true;
  formNota.hidden = false;
  btnModificaNota.hidden = true;
  btnEliminaNota.hidden = true;

  sfondoModaleNota.hidden = false;
}

function salvaFormNota(evento) {
  evento.preventDefault();

  const nota = {
    id: idNotaCorrente,
    sezione: sezioneCorrente,
    titolo: document.getElementById('input-nota-titolo').value.trim(),
    contenuto: document.getElementById('input-nota-contenuto').value.trim()
  };

  if (!nota.titolo) return;

  salvaNota(nota);
  chiudiModaleNota();
  renderElencoNote();
}

function eliminaNotaCorrenteEChiudi() {
  if (!idNotaCorrente) return;
  if (!confirm('Eliminare questa nota?')) return;
  eliminaNota(idNotaCorrente);
  chiudiModaleNota();
  renderElencoNote();
}

function chiudiModaleNota() {
  sfondoModaleNota.hidden = true;
  idNotaCorrente = null;
}

/* ---------------------------------------------------------
   10. HELPER: evitare che titoli/note con < o > rompano l'HTML
   --------------------------------------------------------- */
function escapeHtml(testo) {
  const div = document.createElement('div');
  div.textContent = testo;
  return div.innerHTML;
}

/* ---------------------------------------------------------
   11. AVVIO: disegniamo l'elenco attività appena la pagina carica
   --------------------------------------------------------- */
renderElencoAttivita();
