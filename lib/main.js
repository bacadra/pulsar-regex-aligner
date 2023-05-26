'use babel'

import Dialog from './dialog'

export default {

  activate () {
    this.dialog = new Dialog()
  },

  deactivate () {
    this.dialog.destroy()
  },
}
