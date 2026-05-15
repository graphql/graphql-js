function isJsdoc(comment) {
  return comment.type === 'Block' && comment.value.startsWith('*');
}

function hasTag(comment, tagName) {
  return tagEntries(comment).some((tag) => tag.name === tagName);
}

function parseTags(comment) {
  const tags = new Map();

  for (const { name, text } of tagEntries(comment)) {
    if (!tags.has(name)) {
      tags.set(name, new Map());
    }
    if (name === 'typeParam') {
      const [typeName, description] = splitNameAndDescription(text);
      tags.get(name).set(typeName, description);
    } else {
      tags.get(name).set('*', text);
    }
  }

  return tags;
}

function tagEntries(comment) {
  return commentLines(comment)
    .map(tagEntry)
    .filter((entry) => entry != null);
}

function commentLines(comment) {
  return comment.value.split('\n').map((line, index) => {
    let text = index === 0 && line.startsWith('*') ? line.slice(1) : line;
    text = text.trimStart();
    if (text.startsWith('*')) {
      text = text.slice(1);
    }
    if (text.startsWith(' ')) {
      text = text.slice(1);
    }
    return text.trim();
  });
}

function tagEntry(line) {
  if (!line.startsWith('@')) {
    return null;
  }

  const [name, text] = splitFirstWord(line.slice(1));
  if (name === '') {
    return null;
  }
  return {
    name,
    text,
  };
}

function splitNameAndDescription(text) {
  const [name, description] = splitFirstWord(text);
  return [
    name,
    description.startsWith('-') ? description.slice(1).trim() : description,
  ];
}

function splitFirstWord(text) {
  const trimmed = text.trim();
  const end = firstWhitespace(trimmed);
  if (end === -1) {
    return [trimmed, ''];
  }
  return [trimmed.slice(0, end), trimmed.slice(end).trim()];
}

function firstWhitespace(text) {
  for (let i = 0; i < text.length; i++) {
    if (isWhitespace(text[i])) {
      return i;
    }
  }
  return -1;
}

function isWhitespace(character) {
  return character === ' ' || character === '\t';
}

export { hasTag, isJsdoc, parseTags };
