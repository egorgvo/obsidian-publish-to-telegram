# Плагин Publish to Telegram

[English](https://github.com/pan4ratte/obsidian-publish-to-telegram/blob/main/README.md) | Русский

Этот плагин позволяет постить заметки напрямую в каналы/группы Telegram с разными пресетами. Плагин работает через ваш персональный бот, посылая ему сожержимое активной заметки и информацию о целевом канале/группе. Поддерживается всё стандартное форматирование Telegram, а также прикрепление фото, альбомов и документов, плюс доступны некоторые расширенные настройки публикации.


## Features

1. Create multiple presets to post to different channels.

2. Post in different ways: with hotkeys, command palette and context menus.

3. Attach photos, albums and documents to your posts.

4. Use advanced publishing settings to:

	* Post to multiple channels/groups at once.
	* Post without sound.
	* Post with attached media under the text.

5. Set a default preset to post quickly with it from command palette or with hotkey.

6. Show formating instructions either from plugin's settings or from command palette.


## Инструкции по установке

Пока плагин не появился в официальном магазине Obsidian, проще всего установить его через плагин `BRAT`:

1. Из официального магазина плагинов Obsidian установите плагин `BRAT`.

2. В настройках `BRAT` найдите раздел "Beta plugin list" и нажмите на кнопку "Add beta plugin".

3. В появившемся окне вставьте ссылку на репозиторий плагина `Publish to Telegram`: [https://github.com/pan4ratte/obsidian-publish-to-telegram](https://github.com/pan4ratte/obsidian-publish-to-telegram)

4. В пункте "Select a version" выберите вариант "Latest version" и нажмите на кнопку "Add plugin".

Готово! Плагин автоматически установится и будет готов для использования.


## Использование

### Элементы форматирования

Поддерживаются все стандартные элементы форматирования Telegram:

<table>
  <thead>
    <tr>
      <th>Ввод в Obsidian</th>
      <th>Результат в Telegram</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>**Полужирный**</code></td>
      <td><strong>Полужирный</strong></td>
    </tr>
    <tr>
      <td><code>*Курсив*</code></td>
      <td><em>Курсив</em></td>
    </tr>
    <tr>
      <td><code>&lt;u&gt;Подчёркивание&lt;/u&gt;</code></td>
      <td><u>Подчёркивание</u></td>
    </tr>
    <tr>
      <td><code>~~Зачёркивание~~</code></td>
      <td><s>Зачёркивание</s></td>
    </tr>
    <tr>
      <td><code>&lt;span class="tg-spoiler"&gt;Спойлер&lt;/span&gt;</code></td>
      <td>Спойлер</td>
    </tr>
    <tr>
      <td><code>`Код в строке`</code></td>
      <td><code>Код в строке</code></td>
    </tr>
    <tr>
      <td><code>[Ссылка](url)</code></td>
      <td><a href="https://obsdian.md">Ссылка</a></td>
    </tr>
    <tr>
      <td><code>&gt; Цитата</code></td>
      <td><blockquote>Цитата</blockquote></td>
    </tr>
    <tr>
      <td><code>```Блок кода```</code></td>
      <td><pre><code>Блок кода</code></pre></td>
    </tr>
    <tr>
      <td><code>- Список</code></td>
      <td><ul><li>Список</li></ul></td>
    </tr>
    <tr>
      <td><code># Заголовок</code></td>
      <td><h4>Заголовок</h4></td>
    </tr>
  </tbody>
</table>

### Вложения

Поддерживаются вложения в виде медиа, альбомов (групп медиа) и документов. Обратите внимание на то, что каждый вложенный файл должен находится внутри той же папки, что и активная заметка, которую вы публикуете. Чтобы прикрепить файл к посту, используйте стандартную функцию встраивания в Obsidian:

\`![[файл-какой-то-книги.pdf]]\`

\`![[файл-какой-то-картинки.jpg]]\`

Форматы, поддерживаемые на данный момент:

| Расширение                                         | Тип вложения    |
| -------------------------------------------------- | --------------- |
| \`.jpg\`, \`.jpeg\`, \`.png\`, \`.gif\`, \`.webp\` | Фото / Альбом   |
| \`.pdf\`                                           | Документ        |

### Лимиты

Стандартные лимиты для постов в Telegram применяются к лимитам на количество символов на пост, лимитам по размерам прикреплённых файлов на пост, и т.д. Больше об этом: [https://limits.tginfo.me/](https://limits.tginfo.me/)

### Расширенные настройки публикации

Вы можете вызывать окно расширенных настроек публикации через палитру команд (\`Ctrl + P\`), введя "Publish to Telegram: Опубликовать с расширенными настройками". В этом окне настроек вы можете:

* Сделать пост сразу в несколько каналов/групп.
* Сдлеать пост с уведомлением без звука.
* Сделать пост с прикреплёнными медиа под текстом сообщения.

## Об авторе

Меня зовут Марк Ингрэм, я религиовед, и кроме своего основного направления исследований (протестантская политическая теология в России), я преподаю предмет "Информационные технологии в научных исследованиях" на основании своей собственной уникальной программы. Данный плагин помогает мне в исследованиях, а также я использую его в преподавании, как и другие плагины, которые я разрабатываю и которые вы можете найти в моём профиле на GitHub.

Привет всем студентам, которые зашли на эту страницу!

Большое спасибо [Егору Гвоздикову](https://github.com/egorgvo), который написал первые строчки кода для этого проекта.
