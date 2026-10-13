# Altersvorsorgedepot vs ETF: Niemcy i Polska

Interaktywny kalkulator po polsku. Porównuje cztery scenariusze przy tym samym
miesięcznym budżecie: zwykły akumulujący akcyjny ETF i Altersvorsorgedepot,
z pozostaniem w Niemczech albo przeprowadzką do Polski.

**Strona:** <https://kamil-gwozdz.github.io/altersvorsorge-de-pl/>

## Co można zmieniać

- Wiek początkowy, wiek przeprowadzki i początku wypłat, miesięczny budżet.
- Zwrot, koszty obu produktów, inflację i indeksację progów podatkowych.
- Bieżącą krańcową stawkę PIT, inne dochody na emeryturze i wariant podatku w PL.
- Wypłatę jednorazową do 30%, długość planu wypłat i wiek śmierci.

Wyniki obejmują dopłaty, reinwestowany zwrot PIT, kapitał, wypłaty netto,
podatki i kapitał dla spadkobierców przed podatkiem dochodowym/spadkowym.
Pełne dane z założeniami można pobrać jako JSON.

## Ważne ograniczenia

To edukacyjna analiza scenariuszy, nie porada podatkowa ani prognoza zwrotu.
Domyślny wiek i dochody są hipotetyczne. Zasady sprawdzono 13 października 2026.
Źródła i metoda obliczeń są opisane bezpośrednio na stronie.

Polska kwalifikacja podatkowa nowego AV-depot wymaga potwierdzenia dla
konkretnej umowy. Skala 12% / 32% jest oznaczonym założeniem, nie uzyskaną
interpretacją. Własna stawka służy analizie wrażliwości, nie dowodzi zwolnienia.
Nie modelujemy podatku spadkowego, składek zdrowotnych, historycznych kursów
NBP ani niemieckiego podatku od wyjścia.

W wariancie emigracji zakładamy utratę prawa do nowych niemieckich dopłat:
stary AV pozostaje zainwestowany, nowe wpłaty trafiają do zwykłego ETF.
Po osiągnięciu 150 EUR miesięcznie dodatkowy budżet także trafia do ETF.
Zwrot PIT zawsze jest reinwestowany w osobny ETF; porównanie nie podwaja ulgi.

Plan wypłat jest terminowy, aktualizowany corocznie i trwa co najmniej do
85 lat. Nie jest dożywotnią rentą. W obu strategiach stosujemy taki sam
harmonogram, choć zwykły ETF prawnie nie podlega ograniczeniom AV.

## Uruchomienie i testy

Otwórz `index.html` w przeglądarce. Plik jest samodzielny: brak zewnętrznych
bibliotek, analityki, połączeń do API i instalacji zależności.

```sh
npm test
python3 -m http.server 8000 --bind 127.0.0.1
```

Testy używają wbudowanego runnera Node.js i wykonują ten sam kod modelu,
który jest osadzony w HTML. Obejmują dopłaty, podatki, FIFO, Vorabpauschale,
emigrację, dziedziczenie, zachowanie kapitału i wartości graniczne.
Testy widoku sprawdzają nagłówki tabel oraz zgodność wszystkich punktów wykresu
kapitału z dostępną tabelą, zarówno w kwotach nominalnych, jak i realnych.

GitHub Pages może publikować plik bez etapu budowania. Kod objęty licencją MIT.
Interactive Germany/Poland retirement savings calculator: Altersvorsorgedepot vs ETF.
