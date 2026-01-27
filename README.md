# Cards Against Humanity Clone

Webowa wersja gry "Cards Against Humanity" (Karty Przeciwko Ludzkości) stworzona w Pythonie (Flask + Socket.IO) z frontendem w czystym JavaScript.

## Funkcje

*   **Multiplayer w czasie rzeczywistym:** Oparty na WebSockets.
*   **Persistentne sesje:** Gracze mogą odświeżyć stronę lub wrócić później bez utraty punktów i kart (dzięki tokenom w LocalStorage).
*   **Ustawienia Lobby:** Host może zmienić limit punktów i czas na rundę.
*   **Czarny humor:** Baza ponad 1000 kart w klimacie CAH.
*   **Responsywność:** Działa na komputerach i telefonach.
*   **Brutalistyczny Design:** Ciemny motyw, animacje GSAP.

## Instalacja na Debianie (VPS)

Poniższa instrukcja krok po kroku pomoże Ci uruchomić grę na serwerze VPS z systemem Debian (10/11/12).

### 1. Aktualizacja systemu i instalacja zależności

Zaloguj się na swój serwer przez SSH i wykonaj:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3 python3-pip python3-venv git nginx certbot python3-certbot-nginx -y
```

### 2. Pobranie projektu

Sklonuj repozytorium do katalogu domowego (np. `/opt/cah` lub `~/cah`):

```bash
cd /opt
sudo git clone https://github.com/twoj-user/twoje-repo.git cah
sudo chown -R $USER:$USER cah
cd cah
```

### 3. Konfiguracja środowiska Python

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Uruchomienie próbne

Uruchom serwer ręcznie, aby sprawdzić, czy działa (powinien nasłuchiwać na porcie 3000):

```bash
python3 app.py
```

Wejdź w przeglądarce na `http://TWOJE_IP:3000`. Jeśli działa, zatrzymaj serwer (`Ctrl+C`).

### 5. Konfiguracja jako usługa systemowa (Systemd)

Aby gra działała w tle i uruchamiała się po restarcie serwera, utwórz plik serwisu:

```bash
sudo nano /etc/systemd/system/cah.service
```

Wklej poniższą zawartość (zmień `twoj_uzytkownik` na swoją nazwę użytkownika, np. `root` lub `debian`):

```ini
[Unit]
Description=Cards Against Humanity Game Server
After=network.target

[Service]
User=twoj_uzytkownik
Group=www-data
WorkingDirectory=/opt/cah
Environment="PATH=/opt/cah/venv/bin"
Environment="SECRET_KEY=twoj_bardzo_dlugi_i_tajny_klucz_losowy"
ExecStart=/opt/cah/venv/bin/python app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Zapisz (`Ctrl+O`, Enter) i wyjdź (`Ctrl+X`). Następnie uruchom usługę:

```bash
sudo systemctl daemon-reload
sudo systemctl start cah
sudo systemctl enable cah
```

## Konfiguracja Nginx i SSL (HTTPS)

Aby gra była dostępna pod domeną z bezpiecznym połączeniem (kłódka), skonfigurujemy Nginx jako odwrotne proxy (Reverse Proxy).

### 1. Konfiguracja Nginx

Utwórz plik konfiguracyjny dla swojej domeny:

```bash
sudo nano /etc/nginx/sites-available/cah
```

Wklej zawartość z pliku `nginx_app.conf` znajdującego się w tym repozytorium, pamiętając o zmianie `twoja-domena.pl` na swój adres:

```nginx
server {
    listen 80;
    server_name twoja-domena.pl www.twoja-domena.pl;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:3000/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Zapisz i wyjdź. Następnie aktywuj konfigurację:

```bash
sudo ln -s /etc/nginx/sites-available/cah /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 2. Certyfikat SSL (Let's Encrypt)

Użyj narzędzia Certbot, aby automatycznie pobrać i skonfigurować darmowy certyfikat SSL:

```bash
sudo certbot --nginx -d twoja-domena.pl -d www.twoja-domena.pl
```

Postępuj zgodnie z instrukcjami na ekranie (wybierz przekierowanie ruchu HTTP na HTTPS).

Gotowe! Twoja gra powinna być dostępna pod adresem `https://twoja-domena.pl`.

## Struktura plików

*   `app.py` - Główny plik serwera.
*   `cards.json` - Baza kart.
*   `static/` - Pliki CSS, JS, dźwięki.
*   `templates/` - Pliki HTML.
*   `scripts/` - Skrypty pomocnicze (np. dodawanie kart).
