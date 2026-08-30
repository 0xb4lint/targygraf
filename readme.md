# Tárgygráf – [targygraf.hu](https://targygraf.hu)

Interaktív mintatanterv magyar egyetemi szakokhoz, 2012 óta. Jelölöd, mit
teljesítettél, a gráf pedig megmutatja, mit vehetsz fel, minek mi az
előfeltétele, és hogyan épülnek egymásra a tárgyaid félévről félévre.

Az oldalt hallgatók tartják karban: minden tanterv egy-egy JSON fájl ebben a
repóban. Ha hibát találsz, vagy hiányzik az egyetemed, karod vagy szakod,
néhány kattintással javíthatod vagy felviheted, még fejlesztői tudás sem
kell hozzá.

## Hogyan működik a közreműködés?

1. A tantervek a [`json/`](json/) mappában élnek: minden egyetem, kar és
   szak egy külön fájl.
2. A fájlt a GitHub webes szerkesztőjében is módosíthatod (ceruza ikon).
   A GitHub automatikusan elkészíti a saját másolatod (fork), és felajánlja
   a pull request nyitását.
3. A pull requestre automatikus ellenőrzés fut: formátumhibát, elgépelt
   előfeltétel-kódot azonnal jelez, nem tudsz elrontani semmit.
4. Beolvasztás után az oldal automatikusan újraépül és frissül.

## Tanterv frissítése vagy javítása

A leggyakoribb eset: elavult a tanterv, hibás egy előfeltétel, hiányzik egy
tárgy.

1. Keresd meg a szak fájlját: `json/programs/{egyetem}_{kar}_{szak}.json`,
   például [`json/programs/pe_mik_mernokinformatikus.json`](json/programs/pe_mik_mernokinformatikus.json).
   (A programoldalak alján lévő GitHub-link egyenesen a megfelelő fájl
   szerkesztőjébe visz.)
2. Módosítsd a tárgyakat a lenti [JSON formátumok](#json-formátumok)
   szerint.
3. Frissítsd a `curriculum_updated_at` mezőt a tanterv kiadási / módosítási
   dátumára (`ÉÉÉÉ-HH-NN`).
4. Nyiss pull requestet.

## Új kar vagy szak felvétele

**Új szak** egy már meglévő karhoz:

1. Hozz létre egy új fájlt: `json/programs/{egyetem}_{kar}_{szak}.json`.
   A fájlnév pontosan három részből áll `_` jelekkel elválasztva; a szak
   neve kisbetűs, ékezet nélküli, kötőjeles (pl.
   `bme_vik_mernok-informatikus.json`). Ez lesz az oldal címe is:
   `targygraf.hu/bme/mernok-informatikus`.
2. A tartalom váza:

```javascript
{
    "name": "Mérnökinformatikus",
    "description": "Mérnökinformatikus BSc szak - nappali tagozat tanterve",
    "curriculum_updated_at": "2024-05-20",
    "course_blocks": [ /* félévek és tárgyblokkok, lásd lent */ ]
}
```

3. A `course_blocks` felépítését a [JSON formátumok](#json-formátumok)
   fejezet írja le. Érdemes egy meglévő, hasonló szak fájljából kiindulni.

**Új kar**, ha még nincs meg:

1. Hozz létre egy fájlt: `json/faculties/{egyetem}_{kar}.json`, például
   `json/faculties/pe_mik.json`:

```javascript
{
    "name": "Műszaki Informatikai Kar",
    "ordering": 0    // a kar sorrendje az egyetem oldalán
}
```

2. Utána vidd fel a kar legalább egy szakját a fenti módon.

## Új egyetem felvétele

1. Hozz létre egy fájlt: `json/universities/{egyetem}.json`, ahol a fájlnév
   az egyetem rövid, kisbetűs kódja (pl. `pe.json`, `bme.json`). Ez lesz az
   URL is: `targygraf.hu/{egyetem}`.

```javascript
{
    "name": "Pannon Egyetem",
    "row": 0,           // örökölt megjelenítési mező, hagyd 0-n
    "ordering": 0,      // örökölt megjelenítési mező, hagyd 0-n
    "has_logo": false   // hagyd false-on
}
```

2. Egy egyetem önmagában még nem jelenik meg értelmesen: vigyél fel hozzá
   legalább egy kart és egy szakot is
   ([Új kar vagy szak felvétele](#új-kar-vagy-szak-felvétele)).

## JSON formátumok

### Egyetem

```javascript
// json/universities/pe.json    // a fájlnév az egyetem kódja és URL-je
{
    "name": "Pannon Egyetem",   // string   név
    "row": 0,                   // uint     örökölt megjelenítési mező
    "ordering": 0,              // uint     örökölt megjelenítési mező
    "has_logo": false           // boolean  hagyd false-on
}
```

### Kar

```javascript
// json/faculties/pe_mik.json           // {egyetem}_{kar}
{
    "name": "Műszaki Informatikai Kar", // string   név
    "ordering": 0                       // uint     sorrend az egyetem oldalán
}
```

### Szak

```javascript
// json/programs/pe_mik_mernokinformatikus.json // {egyetem}_{kar}_{szak}
{
    "name": "Mérnökinformatikus",               // string   név
    "description": "Nappali tagozat tanterve",  // string   leírás
    "curriculum_updated_at": "2024-05-20",      // date     a tanterv dátuma (ÉÉÉÉ-HH-NN)
    "course_blocks": [/* tantárgyblokkok */]    // array    lásd lent
}
```

### Tantárgyblokk

A `row: 0` blokkok a felső sorban jelennek meg (ezek a félévek), a
`row: 1` és `row: 2` blokkok külön sorokban alattuk (pl. differenciált /
kötelezően választható tárgycsoportok).

```javascript
// sima félév
{
    "name": "1. félév",         // string   a blokk címe
    "row": 0,                   // uint     0 = félévsor, 1-2 = alsó sorok
    "courses": [/* tárgyak */]  // array
}
```

```javascript
// hivatkozható blokk (választható tárgycsoport)
{
    "name": "Differenciált szakmai tárgy I.",   // string   egyedi név
    "row": 1,
    "courses": [/* tárgyak */]
}
```

```javascript
// kettéosztott hivatkozható blokk: a #2 rész a megjelenítésben rejtve
{
    "name": "Differenciált szakmai tárgy I. #2",
    "row": 1,
    "courses": [/* tárgyak */]
}
```

### Tantárgy

```javascript
// sima tárgy
{
    "code": "VEMIMAB146M",              // string   tárgykód
    "name": "Matematikai analízis I.",  // string   név
    "credits": 6                        // uint     kredit
}
```

```javascript
// tárgy előfeltételekkel
{
    "code": "VEMIMAB244M",
    "name": "Matematikai analízis II.",
    "credits": 4,
    "prerequisites": [
        "VEMIMAB146M"                   // a tárgy kódja ugyanebben a fájlban
    ]
}
```

```javascript
// párhuzamosan felvehető előfeltétel: zárójelben
{
    "code": "VEMISA3144A",
    "name": "Adatstruktúrák és algoritmusok",
    "credits": 4,
    "prerequisites": [
        "VEMIMAB146M",
        "(VETKMA1243D)"                 // elég egyidejűleg felvenni
    ]
}
```

```javascript
// kreditkapu: legalább n teljesített kredit kell hozzá
{
    "code": "VEMIKNB312F",
    "name": "Kutatás-fejlesztés",
    "credits": 2,
    "prerequisites": [
        "___75___"                      // ___20___, ___40___, ___45___, ___50___,
    ]                                   // ___75___, ___120___, ___130___ használható
}
```

```javascript
// választható tárgycsoportra hivatkozó tárgy
{
    "code": null,
    "name": "Differenciált szakmai tárgy I.",
    "credits": 4,                               // ennyi kreditet kell a hivatkozott
    "course_block_references": [                // blokkokban teljesíteni
        "Differenciált szakmai tárgy I.",       // a blokkok pontos neve
        "Differenciált szakmai tárgy I. #2"
    ]
}
```

```javascript
// szabadon választható keret
{
    "code": "___OPTIONAL___",
    "name": "Szabadon választható",
    "credits": 6
}
```

```javascript
// vizuális elválasztó a blokkon belül
{
    "code": "______",
    "name": null,
    "credits": 0
}
```

## Fejlesztés

Az oldal statikus: az Astro-alapú generátor a `json/` fájlokból építi az
összes oldalt.

```sh
npm install
npm test      # a PR-eken is futó teljes ellenőrzés
npm run dev   # helyi fejlesztői szerver
```

A felépítés és a deploy részletei az
[`ARCHITECTURE.md`](ARCHITECTURE.md) fájlban.

## Licenc

[GPL-3.0](LICENSE.md)
