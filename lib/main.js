const { TextEditor, CompositeDisposable, Disposable } = require('atom')

module.exports = {

  activate () {
    this.disposables = new CompositeDisposable()
    this.dialog = new Dialog()
    this.disposables.add(atom.commands.add('atom-text-editor:not([mini])', {
      'regex-aligner:toggle': () => this.dialog.toggle(),
      'regex-aligner:simple': () => this.simple(),
    }))
  },

  deactivate () {
    this.dialog.destroy()
    this.disposables.dispose()
  },

  simple() {
    let editor = atom.workspace.getActiveTextEditor()
    let buffer = editor.getBuffer()
    let cursors = editor.getCursors()
    let cols = cursors.map((c) => c.getBufferColumn())
    let rows = cursors.map((c) => c.getBufferRow())
    let texts = rows.map((r) => editor.lineTextForBufferRow(r))
    let maxCol = Math.max(...cols)
    let aligned = texts.map((text, i) => {
      let col = cols[i]
      let delta = maxCol - col
      let start = text.slice(0, col)
      let mid = ' '.repeat(delta)
      let end = text.slice(col)
      return `${start}${mid}${end}`
    })
    buffer.transact(() => {
      aligned.forEach((text, i) => {
        let row = rows[i]
        let range = [ [row, 0], [row, Infinity] ]
        buffer.setTextInRange(range, text)
      })
      cursors.forEach((cursor) => {
        cursor.moveToBeginningOfLine()
        cursor.moveRight(maxCol)
      })
    })
  },
}

class Dialog {

  constructor() {
    this.disposables = new CompositeDisposable()

    this.element = document.createElement('div')
    this.element.classList.add('dialog')
    this.element.classList.add('regex-dialog')

    this.promptText = document.createElement('label')
    this.promptText.classList.add('icon', 'icon-arrow-right')
    this.promptText.textContent = 'Use a regex to select the separator'
    this.element.appendChild(this.promptText)

    this.miniEditor = new TextEditor({ mini: true })
    this.element.appendChild(this.miniEditor.element)

    const blurHandler = () => { if (document.hasFocus()) { return this.hide() }}
    this.miniEditor.element.addEventListener('blur', blurHandler)
    this.disposables.add(new Disposable(() => this.miniEditor.element.removeEventListener('blur', blurHandler)))

    this.errorMessage = document.createElement('div')
    this.errorMessage.classList.add('text-error')
    this.element.appendChild(this.errorMessage)

    this.disposables.add(atom.commands.add(this.element, {
      'core:confirm': () => this.confirm(),
      'core:cancel': () => this.hide(),
    }))
  }

  destroy() {
    this.disposables.dispose()
    this.miniEditor.destroy()
    if (this.panel) { this.panel.destroy() }
  }

  show() {
    if (!this.panel) {
      this.panel = atom.workspace.addModalPanel({ item:this })
    }
    this.previouslyFocusedElement = document.activeElement
    this.miniEditor.selectAll()
    this.errorMessage.textContent = ''
    this.panel.show()
    this.miniEditor.element.focus()
  }

  hide() {
    this.panel.hide()
    this.previouslyFocusedElement.focus()
  }

  toggle() {
    if (this.panel && this.panel.isVisible()) {
      this.hide()
    } else {
      this.show()
    }
  }

  confirm() {
    let regex = this.miniEditor.getText()
    let editor = atom.workspace.getActiveTextEditor()
    if (!editor || !regex.length) { return }
    try {
      this.tabularize(new RegExp(regex,'g'), editor)
      this.hide()
    } catch (e) {
      this.errorMessage.textContent = 'Error: '+e.message
    }
  }

  tabularize(separator_regex, editor) {
    const currSelRans = editor.getSelectedBufferRanges();

    // Change selections to entire lines inside selections
    for (let selection of editor.getSelections()) {
      let range = selection.getBufferRange();
      let endColumn = range.end.column ? 1e6 : 0
      selection.setBufferRange([[range.start.row, 0], [range.end.row, endColumn]]);
    };

    editor.mutateSelectedText((selection) => {
      let i
      let lines = selection.getText().split("\n");
      let matches = []

      // split lines and save the matches
      lines = lines.map((line) => {
        matches.push(line.match(separator_regex) || "");
        return line.split(separator_regex)
      });

      // strip spaces from cells
      const stripped_lines = this.stripSpaces(lines)

      const num_columns = Math.max(...stripped_lines.map(cells => cells.length))

      const padded_columns = ((() => {
        let asc, end
        const result1 = []
        for (i = 0, end = num_columns-1, asc = 0 <= end; asc ? i <= end : i >= end; asc ? i++ : i--) {
          result1.push(this.paddingColumn(i, stripped_lines))
        }
        return result1;
      })());

      const padded_lines = ((() => {
        let asc1, end1
        const result2 = []
        for (i = 0, end1 = lines.length-1, asc1 = 0 <= end1; asc1 ? i <= end1 : i >= end1; asc1 ? i++ : i--) {
          result2.push(this.paddedLine(i, padded_columns))
        }
        return result2;
      })());

      // Combine padded lines and previously saved matches and join them back
      const result = padded_lines.map((item, i) => {
        return [item, matches[i]]}).map((e) => {
          const line = e[0].map((item, i) => {
            return [item, e[e.length-1][i]]
          }).flat().filter(Boolean).join(' ')
          return this.stripTrailingWhitespace(line);
      }).join("\n")

      return selection.insertText(result)
    });
    return editor.setSelectedBufferRanges(currSelRans)
  }

  // Left align 'string' in a field of size 'fieldwidth'
  leftAlign(string, fieldWidth) {
    const spaces = fieldWidth - string.length
    const right = spaces
    return `${string}${this.repeatPadding(right)}`
  }

  stripTrailingWhitespace(text) {
    return text.replace(/\s+$/g, "")
  }

  repeatPadding(size) {
    return Array(size+1).join(' ')
  }

  // Pad cells of the #nth column
  paddingColumn(col_index, matrix) {
    // Extract the #nth column, extract the biggest cell while at it
    let cell_size = 0;
    const column = matrix.map((line) => {
      if (line.length > col_index) {
        if (cell_size < line[col_index].length) { cell_size = line[col_index].length }
        return line[col_index];
      } else {
        return "";
      }
    });
    // Pad the cells
    return (column.map((cell) => this.leftAlign(cell, cell_size)));
  }

  paddedLine(line_index, columns) {
    // Extract the #nth line
    return columns.map(column => column[line_index]).filter(Boolean)
  }

  stripSpaces(lines) {
    // Strip spaces, but don't strip leading spaces from the first element; we like indenting.
    return lines.map((cells) => {
      return cells.map((cell, i) => {
        if (i === 0) {
          return this.stripTrailingWhitespace(cell)
        } else {
          return cell.trim()
        }
      })
    })
  }
}
