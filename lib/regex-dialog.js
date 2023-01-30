'use babel'

import {TextEditor, CompositeDisposable, Disposable} from 'atom'
import Tabularize from './tabularize'

export default class RegexDialog {

  constructor() {
    this.disposables = new CompositeDisposable()

    this.element = document.createElement('div')
    this.element.classList.add('dialog')
    this.element.classList.add('regex-dialog')

    this.promptText = document.createElement('label')
    this.promptText.classList.add('icon')
    this.promptText.classList.add('icon-arrow-right')
    this.promptText.textContent = 'Use a regex to select the separator'
    this.element.appendChild(this.promptText)

    this.miniEditor = new TextEditor({mini: true})
    this.element.appendChild(this.miniEditor.element)

    const blurHandler = () => { if (document.hasFocus()) { return this.close() } }
    this.miniEditor.element.addEventListener('blur', blurHandler)
    this.disposables.add(new Disposable(() => this.miniEditor.element.removeEventListener('blur', blurHandler)))

    atom.commands.add(this.element, {
      'core:confirm': () => this.confirm(this.miniEditor.getText()),
      'core:cancel': () => this.cancel()
    })
  }

  show() {
    this.previouslyFocusedElement = document.activeElement
    this.panel = atom.workspace.addModalPanel({item: this})
    this.miniEditor.element.focus()
    return this.miniEditor.scrollToCursorPosition()
  }

  close() {
    const { panel } = this
    this.panel = null
    if (panel != null) { panel.destroy() }
    this.disposables.dispose()
    this.miniEditor.destroy()

    if (this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus()
      this.previouslyFocusedElement = null
    } else {
      const activePane = atom.workspace.getCenter().getActivePane()
      if (!activePane.isDestroyed()) { return activePane.activate() }
    }
  }

  cancel() {
    return this.close()
  }

  showError(message) {
    if (message == null) { message = '' }
    this.errorMessage.textContent = message
    if (message) {
      this.element.classList.add('error')
      return window.setTimeout((() => this.element.classList.remove('error')), 300)
    }
  }

  confirm(regex) {
    let editor = atom.workspace.getActiveTextEditor()
    if (!editor || !regex.length) { return }
    Tabularize.tabularize(regex, editor)
    this.close()
  }
}
