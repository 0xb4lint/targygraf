# Tárgygráf - [targygraf.hu](https://targygraf.hu)

## Install
1. `composer install`
2. edit `.env`

## Contributing
1. fork repo
2. edit
3. pull request to `develop` branch

## Migrálás
`php artisan migrate:refresh --seed -vvv`

## Adatbázis
![database](https://github.com/valentinxxx/targygraf/blob/develop/database.png)

## Adatok szerkesztése
### Egyetem
```javascript
// json/universities/pe.json    // string   slug
{
    "name": "Pannon Egyetem",   // string   név
    "row": 0,                   // uint     megjelenítésnél sor index
    "ordering": 0,              // uint     megjelenítésnél soron belüli index
    "has_logo": true            // boolean  public/assets/img/logo/{slug}.svg
}
```

### Kar
```javascript
// json/faculties/pe_mik.json           // string   slug
{
    "name": "Műszaki Informatikai Kar", // string   név
    "ordering": 0                       // uint     megjelenítésnél index
}
```

### Szak
```javascript
// json/programs/pe_mik_mernokinformatikus.json // string   slug
{
    "name": "Mérnökinformatikus",               // string   név
    "description": "Nappali tagozat tanterve",  // string   leírás
    "curriculum_updated_at": "2014-03-25",      // date     tanterv módosítási dátuma
    "course_blocks": [/* course_block */]       // array    tantárgy blokkok - félévek
}
```

#### Tantárgy blokk
```javascript
// course_block - regular
{
    "name": "1. félév",         // string   név
    "row": 0,                   // boolean  megjelenítésnél sor index
    "courses": [/* course */]   // array    tantárgyak
}
```

```javascript
// course_block - referenceable
{
    "name": "Differenciált szakmai tárgy I.",   // string   név (unique)
    "row": 1,                                   // boolean  megjelenítésnél sor index
    "courses": [/* course */]                   // array    tantárgyak
}
```

```javascript
// course_block - referenceable splitted (e.g. https://pe.targygraf.hu/mernokinformatikus)
{
    "name": "Differenciált szakmai tárgy I. #2",    // string   név (unique) - #\d+ rész rejtve
    "row": 1,                                       // boolean  megjelenítésnél sor index
    "courses": [/* course */]                       // array    tantárgyak
}
```

#### Tantárgy
```javascript
// course - regular
{
    "code": "VEMIMAB146M",              // string   kód
    "name": "Matematikai analízis I.",  // string   név
    "credits": 6                        // uint     kreditek
}
```

```javascript
// course - prerequisites
{
    "code": "VEMIMAB244M",              // string   kód
    "name": "Matematikai analízis II.", // string   név
    "credits": 4,                       // uint     kreditek
    "prerequisites": [                  // array    előfeltételek
        "VEMIMAB146M"                   // string   kód
    ]
}
```

```javascript
// course - prerequisites - parallel
{
    "code": "VEMISA3144A",                      // string   kód
    "name": "Adatstruktúrák és algoritmusok",   // string   név
    "credits": 4,                               // uint     kreditek
    "prerequisites": [                          // array    előfeltételek
        "VEMIMAB146M",                          // string   kód
        "VEMKSA2144B",                          // string   kód
        "(VETKMA1243D)"                         // string   kód - zárójelek miatt párhuzamos felvehető előfeltétel
    ]
}
```

```javascript
// course - prerequisites - n credits
{
    "code": "VEMIKNB312F",          // string   kód
    "name": "Kutatás-fejlesztés",   // string   név
    "credits": 2,                   // uint     kreditek
    "prerequisites": [              // array    előfeltételek
        "___75___"                  // string   kód - ___\d+___ formátum - database/seeds/HelperCourseSeeder.php
    ]
}
```

```javascript
// course - referenced course blocks
{
    "code": null,                               // string   null
    "name": "Differenciált szakmai tárgy I.",   // string   név
    "credits": 4,                               // uint     kreditek - melyeket a hivatkozott tantárgy blokkokban kell teljesíteni
    "course_block_references": [                // array    hivatkozott tantárgy blokkok
        "Differenciált szakmai tárgy I.",       // string   név
        "Differenciált szakmai tárgy I. #2"     // string   név
    ]
}
```

```javascript
// course - optional credits
{
    "code": "___OPTIONAL___",       // string   ___OPTIONAL___
    "name": "Szabadon választható", // string   név
    "credits": 6                    // uint     kreditek
}
```

```javascript
// course - visual separator (e.g. https://bme.targygraf.hu/jarmumernok)
{
    "code": "______",   // string   ______
    "name": null,       // string   null
    "credits": 0        // uint     0
}
```
