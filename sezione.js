/*
  sezione.js
  ----------
  Gestisce tutta la pagina sezione.html: capire quale sezione mostrare,
  passare tra Attività / Eventi / Note, passare tra elenco e calendario,
  e aprire i post-it per vedere/modificare/creare attività, eventi e note.

  Le funzioni di lettura/scrittura dati (getAttivita, salvaAttivita, ecc.)
  vengono da storage.js, incluso prima di questo file in sezione.html.

  Attività ed eventi vivono nello stesso "magazzino" (diario_attivita) e si
  distinguono dal campo "tipo". Differenze:
    - attività: una data (scadenza) e uno stato (da svolgere / svolta)
    - evento:   una data di inizio e una di fine, nessuno stato
*/

/* ---------------------------------------------------------
   1. CAPIRE QUALE SEZIONE SIAMO ("scuola" o "personale")
   Leggiamo il parametro dall'URL, es: sezione.html?nome=scuola
   --------------------------------------------------------- */
const parametri = new URLSearchParams(window.location.search);
const sezioneCorrente = parametri.get('nome') === 'personale' ? 'personale' : 'scuola';

const NOMI_SEZIONE = { scuola: 'Scuola', personale: 'Personale' };

// Un'attività è "vicina" se la sua data dista meno di questi giorni da oggi
const GIORNI_VICINE = 7;

// Materie selezionabili (solo nella sezione Scuola). Per aggiungerne una, basta inserirla qui.
const MATERIE = [
  'Italiano', 'Storia', 'Matematica', 'Informatica', 'TPSIT',
  'GPOI', 'Sistemi e reti', 'Inglese', 'Motoria', 'Religione'
];

document.body.classList.add(sezioneCorrente === 'scuola' ? 'tema-scuola' : 'tema-personale');
document.getElementById('nome-sezione-titolo').textContent = NOMI_SEZIONE[sezioneCorrente];

/* ---------------------------------------------------------
   2. SOTTO-TAB: Attività <-> Eventi <-> Note
   --------------------------------------------------------- */
const tabAttivita = document.getElementById('tab-attivita');
const tabEventi = document.getElementById('tab-eventi');
const tabNote = document.getElementById('tab-note');
const pannelloAttivita = document.getElementById('pannello-attivita');
const pannelloEventi = document.getElementById('pannello-eventi');
const pannelloNote = document.getElementById('pannello-note');

tabAttivita.addEventListener('click', () => mostraSottoTab('attivita'));
tabEventi.addEventListener('click', () => mostraSottoTab('eventi'));
tabNote.addEventListener('click', () => mostraSottoTab('note'));

function mostraSottoTab(nome) {
  tabAttivita.classList.toggle('attivo', nome === 'attivita');
  tabEventi.classList.toggle('attivo', nome === 'eventi');
  tabNote.classList.toggle('attivo', nome === 'note');
  pannelloAttivita.hidden = nome !== 'attivita';
  pannelloEventi.hidden = nome !== 'eventi';
  pannelloNote.hidden = nome !== 'note';

  if (nome === 'attivita') {
    aggiornaViste();
  } else if (nome === 'eventi') {
    renderEventi();
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
  aggiornaViste();
}

// Ridisegna le viste attualmente visibili (da chiamare dopo ogni salvataggio/modifica/eliminazione)
function aggiornaViste() {
  if (!pannelloAttivita.hidden) {
    if (vistaCalendarioAttivita.hidden) {
      renderElencoAttivita();
    } else {
      renderCalendario();
    }
  }
  if (!pannelloEventi.hidden) {
    renderEventi();
  }
}

/* ---------------------------------------------------------
   4. HELPER PER LE DATE
   --------------------------------------------------------- */

// Data di oggi nel fuso orario del dispositivo, formato AAAA-MM-GG.
// (toISOString() userebbe l'ora UTC e fra mezzanotte e le 2 darebbe il giorno prima)
function oggiISO() {
  const d = new Date();
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mese}-${giorno}`;
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

// "12 ott" per le attività; "12 ott → 15 ott" per gli eventi su più giorni
function formattaDataRiga(voce) {
  if (voce.tipo === 'evento' && voce.dataFine !== voce.data) {
    return `${formattaDataBreve(voce.data)} → ${formattaDataBreve(voce.dataFine)}`;
  }
  return formattaDataBreve(voce.data);
}

/* ---------------------------------------------------------
   5. RIGA DELL'ELENCO (usata per attività ed eventi)
   --------------------------------------------------------- */
function creaRiga(voce) {
  const eEvento = voce.tipo === 'evento';
  const svolta = !eEvento && voce.stato === 'svolta';
  const nomeTipo = eEvento ? 'evento' : 'attività';

  const riga = document.createElement('div');
  const scaduta = !eEvento && !svolta && giorniDa(voce.data) < 0;
  riga.className = 'riga-elemento' + (svolta ? ' svolta' : '') + (scaduta ? ' scaduta' : '');
  riga.tabIndex = 0;
  riga.setAttribute('role', 'button');

  const checkHtml = eEvento ? '' : `
    <button class="check-stato${svolta ? ' spuntata' : ''}" data-azione="stato"
            aria-pressed="${svolta}"
            aria-label="${svolta ? 'Segna come da svolgere' : 'Segna come svolta'}"
            title="${svolta ? 'Segna come da svolgere' : 'Segna come svolta'}">${svolta ? '✓' : ''}</button>`;

  const materiaHtml = voce.materia ? `<span class="tag-materia">${escapeHtml(voce.materia)}</span>` : '';

  riga.innerHTML = `
    ${checkHtml}
    <span class="data-riga${eEvento ? ' data-riga-larga' : ''}">${formattaDataRiga(voce)}</span>
    <span class="titolo-riga">${escapeHtml(voce.titolo)} ${materiaHtml}</span>
    <span class="estratto-riga">${voce.ora || ''}</span>
    <span class="azioni-riga">
      <button class="icona-azione" data-azione="modifica" aria-label="Modifica ${nomeTipo}" title="Modifica">✏️</button>
      <button class="icona-azione" data-azione="elimina" aria-label="Elimina ${nomeTipo}" title="Elimina">🗑️</button>
    </span>
  `;

  // Spunta "svolta / da svolgere": cambia lo stato senza eliminare nulla
  const bottoneStato = riga.querySelector('[data-azione="stato"]');
  if (bottoneStato) {
    bottoneStato.addEventListener('click', (evento) => {
      evento.stopPropagation();
      cambiaStato(voce.id);
    });
  }

  riga.querySelector('[data-azione="modifica"]').addEventListener('click', (evento) => {
    evento.stopPropagation();
    apriModaleModificaDiretta(voce.id);
  });
  riga.querySelector('[data-azione="elimina"]').addEventListener('click', (evento) => {
    evento.stopPropagation();
    if (!confirm(eEvento ? 'Eliminare questo evento?' : 'Eliminare questa attività?')) return;
    eliminaAttivita(voce.id);
    aggiornaViste();
  });

  // Click sul resto della riga: apre il post-it in sola visualizzazione
  riga.addEventListener('click', () => apriModaleVisualizza(voce.id));
  riga.addEventListener('keydown', (evento) => {
    if (evento.target !== riga) return; // ignora i tasti premuti sui pulsanti interni
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      apriModaleVisualizza(voce.id);
    }
  });

  return riga;
}

function cambiaStato(id) {
  const voce = getAttivitaPerId(id);
  if (!voce || voce.tipo !== 'attivita') return;
  voce.stato = voce.stato === 'svolta' ? 'da_svolgere' : 'svolta';
  salvaAttivita(voce);
  aggiornaViste();
}

/* ---------------------------------------------------------
   6. RENDER: ELENCO ATTIVITÀ (solo attività, non eventi)
   Le "da svolgere" stanno in alto, quelle "svolte" in fondo:
   restano visibili (barrate), non vengono eliminate.
   --------------------------------------------------------- */
function renderElencoAttivita() {
  const attivita = getAttivita(sezioneCorrente).filter(v => v.tipo === 'attivita');
  vistaElencoAttivita.innerHTML = '';

  if (attivita.length === 0) {
    vistaElencoAttivita.innerHTML = '<p class="messaggio-vuoto">Nessuna attività. Creane una con "+ Nuova attività".</p>';
    return;
  }

  // Completate = svolte con la scadenza già passata (restano 3 giorni, poi sono eliminate)
  const completate = attivita.filter(a => a.stato === 'svolta' && giorniDa(a.data) < 0).reverse();
  const attive = attivita.filter(a => !completate.includes(a));
  // Vicine = a meno di 7 giorni da oggi; ci stanno anche le non svolte già scadute
  const vicine = attive.filter(a => giorniDa(a.data) < GIORNI_VICINE);
  const piuAvanti = attive.filter(a => giorniDa(a.data) >= GIORNI_VICINE);

  aggiungiGruppoEventi(vistaElencoAttivita, 'Vicine (entro 7 giorni)', vicine, 'Nessuna attività vicina.');
  aggiungiGruppoEventi(vistaElencoAttivita, 'Più avanti', piuAvanti, 'Nessuna attività più avanti.');

  if (completate.length > 0) {
    const dettagli = document.createElement('details');
    dettagli.className = 'gruppo-passati';
    const sommario = document.createElement('summary');
    sommario.textContent = `Completate (${completate.length})`;
    dettagli.appendChild(sommario);
    const avviso = document.createElement('p');
    avviso.className = 'nota-gruppo';
    avviso.textContent = `Vengono eliminate ${GIORNI_PRIMA_DELL_ELIMINAZIONE} giorni dopo la scadenza.`;
    dettagli.appendChild(avviso);
    completate.forEach(a => dettagli.appendChild(creaRiga(a)));
    vistaElencoAttivita.appendChild(dettagli);
  }
}

/* ---------------------------------------------------------
   7. RENDER: EVENTI (in corso / futuri / passati)
   "In corso" = oggi cade tra la data di inizio e quella di fine (estremi inclusi)
   --------------------------------------------------------- */
function renderEventi() {
  const contenitore = document.getElementById('vista-eventi');
  contenitore.innerHTML = '';

  const oggi = oggiISO();
  const eventi = getAttivita(sezioneCorrente).filter(v => v.tipo === 'evento');

  const inCorso = eventi.filter(e => e.data <= oggi && e.dataFine >= oggi);
  const futuri = eventi.filter(e => e.data > oggi);
  const passati = eventi.filter(e => e.dataFine < oggi).reverse(); // dal più recente

  if (eventi.length === 0) {
    contenitore.innerHTML = '<p class="messaggio-vuoto">Nessun evento. Creane uno con "+ Nuovo evento".</p>';
    return;
  }

  aggiungiGruppoEventi(contenitore, 'In corso', inCorso, 'Nessun evento in corso.');
  aggiungiGruppoEventi(contenitore, 'Futuri', futuri, 'Nessun evento futuro.');

  if (passati.length > 0) {
    const dettagli = document.createElement('details');
    dettagli.className = 'gruppo-passati';
    const sommario = document.createElement('summary');
    sommario.textContent = `Passati (${passati.length})`;
    dettagli.appendChild(sommario);
    passati.forEach(e => dettagli.appendChild(creaRiga(e)));
    contenitore.appendChild(dettagli);
  }
}

function aggiungiGruppoEventi(contenitore, titolo, lista, messaggioVuoto) {
  const intestazione = document.createElement('h2');
  intestazione.className = 'titolo-gruppo';
  intestazione.textContent = titolo;
  contenitore.appendChild(intestazione);

  if (lista.length === 0) {
    const vuoto = document.createElement('p');
    vuoto.className = 'messaggio-vuoto';
    vuoto.textContent = messaggioVuoto;
    contenitore.appendChild(vuoto);
    return;
  }
  lista.forEach(e => contenitore.appendChild(creaRiga(e)));
}

/* ---------------------------------------------------------
   8. RENDER: VISTA CALENDARIO (attività ed eventi insieme)
   Un evento compare in tutti i giorni tra inizio e fine.
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

// Questa voce cade nel giorno indicato?
function voceCadeNelGiorno(voce, dataISO) {
  if (voce.tipo === 'evento') {
    return voce.data <= dataISO && voce.dataFine >= dataISO;
  }
  return voce.data === dataISO;
}

function renderCalendario() {
  const etichetta = new Date(annoCorrente, meseCorrente, 1)
    .toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  document.getElementById('etichetta-mese').textContent =
    etichetta.charAt(0).toUpperCase() + etichetta.slice(1);

  const griglia = document.getElementById('griglia-calendario');
  griglia.innerHTML = '';

  const tutteLeVoci = getAttivita(sezioneCorrente);
  const celleVuote = primoGiornoSettimana(annoCorrente, meseCorrente);
  const totaleGiorni = giorniNelMese(annoCorrente, meseCorrente);
  const oggi = oggiISO();

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
    cella.className = 'cella-giorno' + (dataISO === oggi ? ' oggi' : '');

    const numero = document.createElement('span');
    numero.className = 'numero-giorno';
    numero.textContent = giorno;
    cella.appendChild(numero);

    // Prima gli eventi, poi le attività
    tutteLeVoci
      .filter(v => voceCadeNelGiorno(v, dataISO))
      .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'evento' ? -1 : 1))
      .forEach(v => {
        const chip = document.createElement('button');
        chip.className = 'chip-attivita'
          + (v.tipo === 'evento' ? ' chip-evento' : '')
          + (v.tipo === 'attivita' && v.stato === 'svolta' ? ' svolta' : '');
        chip.textContent = v.titolo;
        chip.title = v.titolo;
        chip.addEventListener('click', (evento) => {
          evento.stopPropagation(); // non deve attivare anche il click sulla cella
          apriModaleVisualizza(v.id);
        });
        cella.appendChild(chip);
      });

    // Cliccando su una cella vuota (non su un chip) si crea una nuova attività con quella data già scelta
    cella.addEventListener('click', () => apriNuovaVoce('attivita', dataISO));

    griglia.appendChild(cella);
  }
}

/* ---------------------------------------------------------
   9. RENDER: ELENCO NOTE
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
   10. MODALE ATTIVITÀ / EVENTO (post-it)
   Lo stesso post-it serve per entrambi: cambiano i campi mostrati.
   --------------------------------------------------------- */
const sfondoModaleAttivita = document.getElementById('sfondo-modale-attivita');
const vistaDettaglioAttivita = document.getElementById('vista-dettaglio-attivita');
const formAttivita = document.getElementById('form-attivita');
const btnModificaAttivita = document.getElementById('btn-modifica-attivita');
const btnEliminaAttivita = document.getElementById('btn-elimina-attivita');
const btnToggleStato = document.getElementById('btn-toggle-stato');
const selectMateria = document.getElementById('input-attivita-materia');

let idAttivitaCorrente = null;   // null = stiamo creando una nuova voce
let tipoCorrente = 'attivita';   // 'attivita' | 'evento'

// Riempie il menu a tendina delle materie (una volta sola)
selectMateria.innerHTML = '<option value="">— Nessuna —</option>' +
  MATERIE.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');

document.getElementById('btn-nuova-attivita').addEventListener('click', () => apriNuovaVoce('attivita'));
document.getElementById('btn-nuovo-evento').addEventListener('click', () => apriNuovaVoce('evento'));
document.getElementById('btn-chiudi-attivita').addEventListener('click', chiudiModaleAttivita);
btnModificaAttivita.addEventListener('click', passaAModifica);
btnEliminaAttivita.addEventListener('click', eliminaVoceCorrenteEChiudi);
btnToggleStato.addEventListener('click', () => {
  cambiaStato(idAttivitaCorrente);
  apriModaleVisualizza(idAttivitaCorrente); // ridisegna il post-it con il nuovo stato
});
formAttivita.addEventListener('submit', salvaFormAttivita);

// Mostra/nasconde i campi del form in base al tipo (attività o evento) e alla sezione
function impostaTipoForm(tipo) {
  tipoCorrente = tipo;
  const eEvento = tipo === 'evento';

  document.getElementById('label-attivita-data').textContent = eEvento ? 'Data di inizio' : 'Data';
  document.getElementById('gruppo-data-fine').hidden = !eEvento;
  document.getElementById('gruppo-materia').hidden = sezioneCorrente !== 'scuola';
  document.getElementById('btn-salva-attivita').textContent = eEvento ? 'Salva evento' : 'Salva attività';
}

function apriModaleVisualizza(id) {
  const dati = getAttivitaPerId(id);
  if (!dati) return;
  idAttivitaCorrente = id;
  tipoCorrente = dati.tipo;
  const eEvento = dati.tipo === 'evento';

  const badge = document.getElementById('dettaglio-attivita-tipo');
  badge.textContent = eEvento ? 'Evento' : (dati.stato === 'svolta' ? 'Attività · svolta' : 'Attività · da svolgere');

  document.getElementById('dettaglio-attivita-titolo').textContent = dati.titolo;

  document.getElementById('dettaglio-attivita-etichetta-data').textContent = eEvento ? 'Periodo' : 'Data';
  document.getElementById('dettaglio-attivita-data').textContent =
    eEvento && dati.dataFine !== dati.data
      ? `Dal ${formattaDataLunga(dati.data)} al ${formattaDataLunga(dati.dataFine)}`
      : formattaDataLunga(dati.data);

  const rigaOra = document.getElementById('riga-dettaglio-ora');
  rigaOra.hidden = !dati.ora;
  document.getElementById('dettaglio-attivita-ora').textContent = dati.ora || '';

  const rigaMateria = document.getElementById('riga-dettaglio-materia');
  rigaMateria.hidden = !dati.materia;
  document.getElementById('dettaglio-attivita-materia').textContent = dati.materia || '';

  document.getElementById('dettaglio-attivita-note').textContent = dati.note || '—';

  // Il pulsante stato esiste solo per le attività
  btnToggleStato.hidden = eEvento;
  btnToggleStato.textContent = dati.stato === 'svolta' ? 'Segna come da svolgere' : 'Segna come svolta';

  vistaDettaglioAttivita.hidden = false;
  formAttivita.hidden = true;
  btnModificaAttivita.hidden = false;

  sfondoModaleAttivita.hidden = false;
}

function passaAModifica() {
  const dati = getAttivitaPerId(idAttivitaCorrente);
  if (!dati) return;
  impostaTipoForm(dati.tipo);

  document.getElementById('form-attivita-intestazione').textContent =
    dati.tipo === 'evento' ? 'Modifica evento' : 'Modifica attività';
  document.getElementById('input-attivita-titolo').value = dati.titolo;
  document.getElementById('input-attivita-data').value = dati.data;
  document.getElementById('input-attivita-data-fine').value = dati.dataFine || dati.data;
  document.getElementById('input-attivita-ora').value = dati.ora || '';
  selectMateria.value = dati.materia || '';
  document.getElementById('input-attivita-note').value = dati.note || '';

  vistaDettaglioAttivita.hidden = true;
  formAttivita.hidden = false;
  btnModificaAttivita.hidden = true;
  btnEliminaAttivita.hidden = false;
}

// Usata dal pulsante ✏️ nella riga: apre il post-it già pronto per la modifica,
// saltando il passaggio di sola visualizzazione
function apriModaleModificaDiretta(id) {
  idAttivitaCorrente = id;
  sfondoModaleAttivita.hidden = false;
  passaAModifica();
}

function apriNuovaVoce(tipo, dataPreimpostata) {
  idAttivitaCorrente = null;
  impostaTipoForm(tipo);

  const data = dataPreimpostata || oggiISO();
  document.getElementById('form-attivita-intestazione').textContent =
    tipo === 'evento' ? 'Nuovo evento' : 'Nuova attività';
  document.getElementById('input-attivita-titolo').value = '';
  document.getElementById('input-attivita-data').value = data;
  document.getElementById('input-attivita-data-fine').value = data;
  document.getElementById('input-attivita-ora').value = '';
  selectMateria.value = '';
  document.getElementById('input-attivita-note').value = '';

  vistaDettaglioAttivita.hidden = true;
  formAttivita.hidden = false;
  btnModificaAttivita.hidden = true;
  btnEliminaAttivita.hidden = true;

  sfondoModaleAttivita.hidden = false;
}

function salvaFormAttivita(evento) {
  evento.preventDefault();

  const esistente = idAttivitaCorrente ? getAttivitaPerId(idAttivitaCorrente) : null;
  const data = document.getElementById('input-attivita-data').value;

  const voce = {
    id: idAttivitaCorrente,
    sezione: sezioneCorrente,
    tipo: tipoCorrente,
    titolo: document.getElementById('input-attivita-titolo').value.trim(),
    data: data,
    ora: document.getElementById('input-attivita-ora').value,
    materia: sezioneCorrente === 'scuola' ? selectMateria.value : '',
    note: document.getElementById('input-attivita-note').value.trim()
  };

  if (!voce.titolo || !voce.data) return; // il browser già blocca grazie a "required"

  if (tipoCorrente === 'evento') {
    const dataFine = document.getElementById('input-attivita-data-fine').value || data;
    if (dataFine < data) {
      alert('La data di fine non può essere precedente a quella di inizio.');
      return;
    }
    voce.dataFine = dataFine;
  } else {
    // In modifica si conserva lo stato già scelto; una nuova attività parte "da svolgere"
    voce.stato = esistente ? esistente.stato : 'da_svolgere';
  }

  salvaAttivita(voce);
  chiudiModaleAttivita();
  aggiornaViste();
}

function eliminaVoceCorrenteEChiudi() {
  if (!idAttivitaCorrente) return;
  const domanda = tipoCorrente === 'evento' ? 'Eliminare questo evento?' : 'Eliminare questa attività?';
  if (!confirm(domanda)) return;
  eliminaAttivita(idAttivitaCorrente);
  chiudiModaleAttivita();
  aggiornaViste();
}

function chiudiModaleAttivita() {
  sfondoModaleAttivita.hidden = true;
  idAttivitaCorrente = null;
}

/* ---------------------------------------------------------
   11. MODALE NOTA (post-it)
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
   12. HELPER: evitare che titoli/note con < o > rompano l'HTML
   --------------------------------------------------------- */
function escapeHtml(testo) {
  const div = document.createElement('div');
  div.textContent = testo;
  return div.innerHTML;
}

/* ---------------------------------------------------------
   13. AVVIO: puliamo le attività svolte scadute da più di 3 giorni,
   poi disegniamo l'elenco attività
   --------------------------------------------------------- */
eliminaSvolteScadute();
renderElencoAttivita();
