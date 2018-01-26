/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes
*/

define([
    'jquery',
    'base/js/namespace',
    'base/js/events',
    'notebook/js/cell',
    'notebook/js/codecell',
    'notebook/js/textcell',
    '../janus/janus_history'
], function(
    $,
    Jupyter,
    events,
    Cell,
    CodeCell,
    TextCell,
    JanusHistory
){

// PATCH CELL FUNCTIONS
    function patchCellSelect() {
        /* patch cell selection to handle sidebar highlighting */

        var oldCellSelect = Cell.Cell.prototype.select;
        Cell.Cell.prototype.select = function() {

            // unselect all cells in the sidebar
            if (! Jupyter.sidebar.collapsed) {
                sb_cells = Jupyter.sidebar.cells
                for(var i=0; i < sb_cells.length; i++){
                    sb_cells[i].selected = false
                    sb_cells[i].element.removeClass('selected')
                    sb_cells[i].element.addClass('unselected')
                }
            }

            // if this cell is hidden, select the proper cell in the sidebar
            if (this.metadata.janus.cell_hidden) {

                // TODO find more robust way to find placeholder associated with thei cell
                $(this.element).nextAll('.indent-marker').first().addClass('active')
                if (! Jupyter.sidebar.collapsed && this.sb_cell != undefined) {
                    this.sb_cell.selected = true;
                    this.sb_cell.element.removeClass('unselected');
                    this.sb_cell.element.addClass('selected');
                }
            }

            // do the normal cell selection
            oldCellSelect.apply(this, arguments);
        }
    }


    function patchToMarkdown() {
        /* ensure new cells have a unique janus id and sidebar updates

        Jupyter converts to markdown by creating an entirely new cell
        Make sure this new cell has a new cell id
        */

        var oldToMarkdown = Jupyter.notebook.__proto__.to_markdown;
        Jupyter.notebook.__proto__.to_markdown = function() {
            oldToMarkdown.apply(this, arguments);

            //
            var selCells = Jupyter.notebook.get_selected_cells();
            for (var i = 0; i < selected_cells.length; i++) {
                selCells[i].metadata.janus.cell_id = Math.random().toString(16).substring(2);
            }

            // update the sidebar
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();

            // render and focus markdown cell
            if(!Jupyter.sidebar.collapsed){
                for (i = 0; i<selected_cells.length; i++) {
                    if (selCells[i].sb_cell) {
                        selCells[i].sb_cell.unrender()
                    }
                }
                if (selCells[0].sb_cell) {
                    selCells[0].sb_cell.focus_editor()
                }

            }
        }
    }


    function patchToCode() {
        /* ensure new cells have a unique janus id and sidebar updates


        Jupyter converts to code by creating an entirely new cell
        Make sure this new cell has a new cell id
        */
        var oldToCode = Jupyter.notebook.__proto__.to_code;
        Jupyter.notebook.__proto__.to_code = function() {
            oldToCode.apply(this, arguments);

            selCells = Jupyter.notebook.get_selected_cells();
            for (i=0; i<selected_cells.length; i++) {
                selCells[i].metadata.janus.cell_id = Math.random().toString(16).substring(2);
            }

            // update the sidebar
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();

            // select the first cell in the sidebar
            if (selCells[0].sb_cell) {
                selCells[0].sb_cell.focus_editor()
            }
        }
    }


    function patchCodeExecute() {
        /* execute main cell using sidebar text, then update sidebar cell */

        var oldCodeCellExecute = CodeCell.CodeCell.prototype.execute;
        CodeCell.CodeCell.prototype.execute = function() {
            that = this;

            // function to run once cell is executed
            function updateCellOnExecution(evt) {
                that.sb_cell.fromJSON( that.toJSON() );
                JanusHistory.render_markers(that.sb_cell);
                events.off('kernel_idle.Kernel', updateCellOnExecution);
            }

            // run hidden cells with text from the sidebar, then update sidebar
            var janusMeta = this.metadata.janus;
            if (janusMeta.cell_hidden || janusMeta.source_hidden || janusMeta.output_hidden) {
                this.set_text( this.sb_cell.get_text() )
                oldCodeCellExecute.apply(this, arguments);
                events.on('kernel_idle.Kernel', updateCellOnExecution);
            } else {
                oldCodeCellExecute.apply(this, arguments);
            }

            // update cell version markers if needed
            JanusHistory.render_markers(this);
        }
    }


    function patchTextRender() {
        /* render main cell using sidebar text, then update sidebar cell */

        var oldTextCellRender = TextCell.MarkdownCell.prototype.render;
        TextCell.MarkdownCell.prototype.render = function() {

            if (this.metadata.janus.cell_hidden && this.sb_cell != undefined) {
                this.set_text( this.sb_cell.get_text() );
                oldTextCellRender.apply(this, arguments);
                this.sb_cell.fromJSON( this.toJSON() );
            } else {
                oldTextCellRender.apply(this, arguments);
            }
        }
    }


// PATCH NB FUNCTIONS
    function patchInsertCellAtIndex() {
        /* ensure new cells have a unique janus id and sidebar updates */

        var oldInsertCellAtIndex = Jupyter.notebook.__proto__.insert_cell_at_index;
        Jupyter.notebook.__proto__.insert_cell_at_index = function() {
            c = oldInsertCellAtIndex.apply(this, arguments);

            // if creating a new cell after a hidden one, make new cell hidden
            generateDefaultCellMetadata(c);
            curMetadata = Jupyter.notebook.get_selected_cell().metadata;
            if (curMetadata.janus.cell_hidden) {
                c.metadata.janus.cell_hidden = true;
                Jupyter.sidebar.hideIndentedCells();
                Jupyter.sidebar.update();
            }

            // make sure to return the new cell as other functions us it
            return c;
        }
    }


    function patchMoveSelectionUp() {
        /* Update sidebar after the move */

        var oldMoveSelectionUp = Jupyter.notebook.__proto__.move_selection_up;
        Jupyter.notebook.__proto__.move_selection_up = function() {
            oldMoveSelectionUp.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }


    function patchMoveSelectionDown() {
        /* Update sidebar after the move */

        var oldMoveSelectionDown = Jupyter.notebook.__proto__.move_selection_down;
        Jupyter.notebook.__proto__.move_selection_down = function() {
            oldMoveSelectionDown.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }


    function patchMergeCellAbove() {
        /* Update sidebar after the merge */

        var oldMergeCellAbove = Jupyter.notebook.__proto__.merge_cell_above;
        Jupyter.notebook.__proto__.merge_cell_above = function() {
            oldMergeCellAbove.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }


    function patchMergeCellBelow() {
        /* Update sidebar after the merge */
        var oldMergeCellBelow = Jupyter.notebook.__proto__.merge_cell_below;
        Jupyter.notebook.__proto__.merge_cell_below = function() {
            oldMergeCellBelow.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }


    function patchDeleteCells() {
        /* Update sidebar after the deletion */

        var oldDeleteCells = Jupyter.notebook.__proto__.delete_cells;
        Jupyter.notebook.__proto__.delete_cells = function() {
            oldDeleteCells.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }


    function patchSplitCell() {
        /* ensure split cells have a unique janus id and sidebar updates */
        // TODO this is a pretty involved patch, see if we can be less invasive

        var oldSplitCell = Jupyter.notebook.__proto__.split_cell;
        Jupyter.notebook.__proto__.split_cell = function() {

            var cell = Jupyter.notebook.get_selected_cell();
            if (cell.metadata.janus.cell_hidden) {
                if (cell.sb_cell.is_splittable()) {
                    var texta = cell.sb_cell.get_pre_cursor();
                    var textb = cell.sb_cell.get_post_cursor();

                    // current cell becomes the second one
                    // so we don't need to worry about selection
                    cell.set_text(textb);

                    // create new cell with same type
                    var new_cell = Jupyter.notebook.insert_cell_above(cell.cell_type);

                    // Unrender the new cell so we can call set_text.
                    new_cell.unrender();
                    new_cell.set_text(texta);

                    // set new sidebar cell metadata
                    new_cell.metadata.janus = JSON.parse(JSON.stringify(cell.metadata.janus));
                    new_cell.metadata.janus.cell_id = Math.random().toString(16).substring(2);
                }

                // update the sidebar
                Jupyter.sidebar.hideIndentedCells();
                Jupyter.sidebar.update();
            } else {
                oldSplitCell.apply(this, arguments);
            }
        }
    }


    function patchPasteCellAbove() {
        /* ensure pasted cells have a unique janus id and sidebar updates */

        var oldPasteCellAbove = Jupyter.notebook.__proto__.paste_cell_above;
        Jupyter.notebook.__proto__.paste_cell_above = function() {
            for (var i = 0; i < Jupyter.notebook.clipboard.length; i++) {
                Jupyter.notebook.clipboard[i].metadata.janus.cell_id = Math.random().toString(16).substring(2);
            }
            oldPasteCellAbove.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }


    function patchPasteCellBelow() {
        /* ensure pasted cells have a unique janus id and sidebar updates */

        var oldPasteCellBelow = Jupyter.notebook.__proto__.paste_cell_below;
        Jupyter.notebook.__proto__.paste_cell_below = function() {
            for (var i = 0; i < Jupyter.notebook.clipboard.length; i++) {
                Jupyter.notebook.clipboard[i].metadata.janus.cell_id = Math.random().toString(16).substring(2);
            }
            oldPasteCellBelow.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }


    function patchPasteCellReplace() {
        /* ensure pasted cells have a unique janus id and sidebar updates */

        var oldPasteCellReplace = Jupyter.notebook.__proto__.paste_cell_replace;
        Jupyter.notebook.__proto__.paste_cell_replace = function() {
            //ensure newly created cells have a unique janus id
            for (var i = 0; i < Jupyter.notebook.clipboard.length; i++) {
                Jupyter.notebook.clipboard[i].metadata.janus.cell_id = Math.random().toString(16).substring(2);
            }
            oldPasteCellReplace.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }


    function patchEditMode(){
        /* handle going to edit mode when sidebar cell is selected */

        var oldEditMode = Jupyter.notebook.__proto__.edit_mode;
        Jupyter.notebook.__proto__.edit_mode = function() {
            var cell = Jupyter.notebook.get_selected_cell()
            if (cell.metadata.janus.cell_hidden) {
                cell.sb_cell.unrender()
                cell.sb_cell.focus_editor()
            } else {
                oldEditMode.apply(this, arguments);
            }
        }
    }


    function patchCommandMode() {
        /* handle going to command mode when sidebar cell is selected */
        
        var oldCommandMode = Jupyter.notebook.__proto__.command_mode;
        Jupyter.notebook.__proto__.command_mode = function() {
            cell = Jupyter.notebook.get_selected_cell()
            if (cell.metadata.janus.cell_hidden) {
                cell.sb_cell.code_mirror.getInputField().blur()
            } else {
                oldCommandMode.apply(this, arguments);
            }
        }
    }


// JANUS METADATA
    function generateDefaultCellMetadata(cell) {
        /* generate default Janus metadata for a cell */

        var defaultCellMetadata = {
            'id': Math.random().toString(16).substring(2),
            'cell_hidden': false,
            'source_hidden': false,
            'ouput_hidden': false,
            'track_versions': false,
            'versions_showing': false,
            'versions': [],
            'current_version': 0
        }

        if (cell.metadata.janus === undefined) {
            cell.metadata.janus = defaultCellMetadata;
        } else {
            for (var key in defaultCellMetadata) {
                if (! cell.metadata.janus.hasOwnProperty(key)) {
                    cell.metadata.janus[key] =  defaultCellMetadata[key];
                }
            }
        }
    }


    function generateDefaultNBMetadata() {
        /* generate default Janus metadata for the notebook */

        nb_meta = Jupyter.notebook.metadata

        // flag whether we want to track a full history of the notebook
        if (nb_meta.track_history === undefined) {
            nb_meta.track_history = true;
        }

        // track previous names of the notebook to maintain full history
        if (nb_meta.filepaths === undefined) {
            nb_meta.filepaths = [];
        }
    }


    function initializeJanusMetadata() {
        /* ensure the notebook and all cells have proper Janus metadata */

        generateDefaultNBMetadata();

        cells = Jupyter.notebook.get_cells();
        for (i = 0; i<cells.length; i++) {
            generateDefaultCellMetadata(cells[i]);
        }
    }


    function applyJanusPatches() {
        /* Patch all functions needed to run Janus extension */

        console.log('[Janus] Patching Cell.cell_select, Cell.to_markdown,' +
        'Cell.to_code, CodeCell.execute, MarkdownCell.render, ' +
        'Notebook.move_selection_up, Notebook.move_selection_down, ' +
        'Notebook.paste_cell_above, Notebook.paste_cell_below, ' +
        'Notebook.paste_cell_replace, Notebook.split_cell, ' +
        'Notebook.merge_cell_above, Notebook.merge_cell_below, ' +
        'Notebook.edit_mode, Notebook.command_mode, Notebook.delete_cells')

        // patch cell functions
        patchCellSelect();
        patchToMarkdown();
        patchToCode();
        patchCodeExecute();
        patchTextRender();

        //patch notebook functions
        patchInsertCellAtIndex();
        patchMoveSelectionUp();
        patchMoveSelectionDown();
        patchMergeCellAbove();
        patchMergeCellBelow();
        patchDeleteCells();
        patchSplitCell();
        patchPasteCellAbove();
        patchPasteCellBelow();
        patchPasteCellReplace();
        patchEditMode();
        patchCommandMode();
    }


    return {
        applyJanusPatches: applyJanusPatches,
        generateDefaultCellMetadata: generateDefaultCellMetadata,
        initializeJanusMetadata: initializeJanusMetadata
    };

});
