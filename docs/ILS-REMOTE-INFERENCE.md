# Entfernter Inference-Server (ILS-Fork, Branch `ils`)

Upstream-ZotSeek spricht nur mit einem Inference-Server auf dem eigenen Rechner
(`127.0.0.1`, `localhost`, `[::1]`); eine Einstellung zum Abschalten gibt es dort nicht.
Dieser Fork ergänzt eine ausdrücklich freizugebende Liste weiterer Hosts, z. B. den
Ollama-Server auf der GPU-Maschine.

## Einstellung

- Oberfläche: *Einstellungen → ZotSeek → Local inference server → Allowed remote hosts (dangerous)*
- Pref: `zotseek.server.allowedRemoteHosts` (ohne `extensions.zotero.`-Präfix: ZotSeek liest seine
  Einstellungen mit `Zotero.Prefs.get(key, true)`, also als globale Prefs; der Eintrag in `prefs.js`
  folgt nur der Schreibweise von upstream und greift nicht), kommagetrennte Hostnamen,
  Standard leer (= streng lokal). Schema, Port und Pfad werden entfernt, der Vergleich ist exakt
  (`ollama.ils.local` erlaubt nicht `ollama.ils.local.example.com`, keine Wildcards).
- Danach als Server-URL z. B. `https://ollama.ils.local` eintragen und *Test connection*.

## Gefahr

Mit einem entfernten Host gilt das Privacy-Versprechen von ZotSeek („nichts verlässt den
Rechner“) **nicht mehr**:

- Der gesamte indexierte Text (Titel, Abstracts, PDF-Volltext, bei aktivierter Option auch
  Notizen) und **jede Suchanfrage** gehen an diesen Host.
- Wer den Host betreibt, administriert oder seine Logs lesen kann, kann diese Inhalte lesen.
  Bei `http://` statt `https://` zusätzlich jeder im Netzwerk dazwischen.
- Ein kompromittierter oder falsch konfigurierter Host (DNS, Reverse-Proxy) erhält dieselben Daten.

Nur Hosts im eigenen, vertrauenswürdigen Netz eintragen, an die diese Daten gehen dürfen
(auch urheber- und datenschutzrechtlich), und immer `https://` verwenden.

## Was unverändert bleibt

- Jede Anfrage-URL wird weiterhin zur Laufzeit geprüft, nicht nur beim Konfigurieren.
- Weiterleitungen werden nicht verfolgt (`redirect: 'error'`), auch nicht zu erlaubten Hosts.
- Zugangsdaten in der URL (`user:pass@host`) bleiben verboten; ein API-Key geht über das Feld
  *API key* als `Authorization: Bearer`.

## Code

- `src/core/loopback-url.ts`: Pref lesen, Hostliste normalisieren, Prüfung erweitern
- `src/ui/preferences.ts`, `content/preferences.xhtml`: Eingabefeld mit Warnung, Hinweis im
  Verbindungsstatus bei entfernten Hosts
- `prefs.js`: Standardwert
- `test/loopback-url.test.ts`: Tests
