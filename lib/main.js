'use babel'

import { CompositeDisposable } from 'atom'
import RegexDialog from './regex-dialog'

export default {

  activate () {
    this.subscriptions = new CompositeDisposable;

    this.subscriptions.add(
      atom.commands.add('atom-text-editor', {
        'regex-aligner:toggle': () => this.toggle(),
      }),
    )

  },

  deactivate () {
    return this.subscriptions.dispose();
  },

  toggle () {
    new RegexDialog().show()
  }
}
