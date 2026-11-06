# Источник модели подиума

`runway-human.glb` собран из моделей MakeHuman, экспортированных проектом CharacterCreator. Исходные файлы закреплены на ревизии `852e48f316b90a0937234886630e4fb4cdfd1f78`.

- `base_body.glb` — тело и лицо, кожа, глаза, брови и ресницы.
- `hair_short04.glb` — короткая причёска.
- `clothing_tshirt.glb`, `clothing_jeans.glb` и `clothing_shoes.glb` — одежда и обувь с текстурами.

Автор распространяет эти GLB под CC0-1.0. [Исходные файлы](https://github.com/kblood/CharacterCreator/tree/852e48f316b90a0937234886630e4fb4cdfd1f78/output) · [Лицензия файлов моделей](https://github.com/kblood/CharacterCreator/blob/852e48f316b90a0937234886630e4fb4cdfd1f78/LICENSE-NOTES.md#generated-files-owner-decision-2026-10-03) · [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)

Скрипт `tools/build_runway_actor.py` объединяет пять файлов, опускает руки одним поворотом скелета для тела и одежды, запекает позу и исключает закрытые одеждой полигоны. Сохраняет геометрию, UV, нормали и карты материалов. Для принтов используются фотографии трёх карточек Our Souls, которые уже есть в магазине.
