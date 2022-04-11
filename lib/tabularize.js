'use babel'

import _ from 'underscore';

export default Tabularize = class Tabularize {

    static tabularize(separator, editor) {
      const currSelRans = editor.getSelectedBufferRanges();

      // Change selections to entire lines inside selections
      _(editor.getSelections()).each(function(selection) {
        const range = selection.getBufferRange();
        const first_row = range.start.row;
        const last_row = range.end.row;
        const last_column = range.end.column;
        selection.setBufferRange([[first_row,0],[last_row,last_column]]);
        if (!selection.isReversed()) {
          return selection.selectToEndOfLine();
        }
      });

      editor.mutateSelectedText(function(selection, index) {
        let i;
        const separator_regex = RegExp(separator,'g');
        let lines = selection.getText().split("\n");
        let matches = [];

        // split lines and save the matches
        lines = _(lines).map(function(line) {
          matches.push(line.match(separator_regex) || "");
          return line.split(separator_regex);
        });

        // strip spaces from cells
        const stripped_lines = Tabularize.stripSpaces(lines);

        const num_columns = _.chain(stripped_lines).map(cells => cells.length).max()
        .value();

        const padded_columns = ((() => {
          let asc, end;
          const result1 = [];
          for (i = 0, end = num_columns-1, asc = 0 <= end; asc ? i <= end : i >= end; asc ? i++ : i--) {
            result1.push(Tabularize.paddingColumn(i, stripped_lines));
          }
          return result1;
        })());

        const padded_lines = ((() => {
          let asc1, end1;
          const result2 = [];
          for (i = 0, end1 = lines.length-1, asc1 = 0 <= end1; asc1 ? i <= end1 : i >= end1; asc1 ? i++ : i--) {
            result2.push(Tabularize.paddedLine(i, padded_columns));
          }
          return result2;
        })());

        // Combine padded lines and previously saved matches and join them back
        const result = _.chain(padded_lines).zip(matches).map(function(e) {
          let line = _(e).first();
          matches = _(e).last();
          line = _.chain(line).zip(matches).flatten().compact().value().join(' ');
          return Tabularize.stripTrailingWhitespace(line);}).value().join("\n");

        return selection.insertText(result);
      });
      return editor.setSelectedBufferRanges(currSelRans);
    }

    // Left align 'string' in a field of size 'fieldwidth'
    static leftAlign(string, fieldWidth) {
      const spaces = fieldWidth - string.length;
      const right = spaces;
      return `${string}${Tabularize.repeatPadding(right)}`;
    }

    static stripTrailingWhitespace(text) {
      return text.replace(/\s+$/g, "");
    }

    static repeatPadding(size) {
      return Array(size+1).join(' ');
    }

    // Pad cells of the #nth column
    static paddingColumn(col_index, matrix) {
      // Extract the #nth column, extract the biggest cell while at it
      let cell_size = 0;
      const column = _(matrix).map(function(line) {
        if (line.length > col_index) {
          if (cell_size < line[col_index].length) { cell_size = line[col_index].length; }
          return line[col_index];
        } else {
          return "";
        }
      });

      // Pad the cells
      return (column.map((cell) => Tabularize.leftAlign(cell, cell_size)));
    }

    // Extract the #nth line
    static paddedLine(line_index, columns) {
      // extract #nth line, filter null values and return
      return _.chain(columns).map(column => column[line_index])
      .compact()
      .value();
    }

    static stripSpaces(lines) {
      // Strip spaces
      //   - Don't strip leading spaces from the first element; we like indenting.
      return _.map(lines, cells => cells = _.map(cells, function(cell, i) {
        if (i === 0) {
          return Tabularize.stripTrailingWhitespace(cell);
        } else {
          return cell.trim();
        }
      }));
    }
  };
