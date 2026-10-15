# Fantasy Craft – Admin-Login und zentrale Teilnehmerliste

## Was enthalten ist
- Öffentliche Teilnehmerliste, für alle Besucher gleich
- Admin-Anmeldung serverseitig geprüft
- Nur Admin darf Teilnehmer hinzufügen/aktualisieren oder entfernen
- Teilnehmer in SQLite gespeichert, nicht im Besucher-Browser
- Sitzungscookie `HttpOnly`/`SameSite=Strict`, Login-Versuche begrenzt

## Lokal starten
Voraussetzung: Node.js 20 oder neuer.

1. `.env` enthält bereits den gewünschten Admin-Benutzernamen und das Passwort. Teile diese Datei nicht und lade sie nicht öffentlich hoch.
2. Im Projektordner ausführen:
   ```sh
   npm install
   npm start
   ```
3. Öffne `http://localhost:3000`.

## Öffentlichen Server bereitstellen
Diese Projektdateien müssen auf einen Node.js-Host hochgeladen werden, der dauerhaft läuft und persistente Dateien unterstützt. `NODE_ENV=production` setzen und HTTPS am Host aktivieren. Ändere außerdem `SESSION_SECRET` in einen langen zufälligen Wert. Stelle sicher, dass das Verzeichnis `data/` auf dauerhaftem Speicher liegt, sonst können Daten beim Neustart oder Redeploy verloren gehen.

Die HTML-Datei allein reicht nicht für echten Zugriffsschutz. Der Schutz wird durch `server.js` umgesetzt. Nicht nur `public/index.html` separat hochladen – sonst fehlt der Server und die zentrale Datenbank.
