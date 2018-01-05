define([
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/events',
    'base/js/utils',
    'notebook/js/cell',
    'notebook/js/codecell',
    'notebook/js/textcell'
], function(
    require,
    $,
    Jupyter,
    events,
    utils,
    Cell,
    CodeCell,
    TextCell
){

    function applyJanusPatches(){
        console.log('[Janus] Patching Cell.cell_select, Cell.to_markdown,' +
        'Cell.to_code, CodeCell.execute, MarkdownCell.render, ' +
        'Notebook.move_selection_up, Notebook.move_selection_down, ' +
        'Notebook.paste_cell_above, Notebook.paste_cell_below, ' +
        'Notebook.paste_cell_replace, Notebook.split_cell, ' +
        'Notebook.merge_cell_above, Notebook.merge_cell_below, ' +
        'Notebook.edit_mode, Notebook.command_mode, Notebook.delete_cells')

        patchCellSelect();
        patchToMarkdown();
        patchToCode();
        patchCodeExecute();
        patchTextRender();

        patchInsertCellAtIndex();
        patchMoveSelectionUp();
        patchMoveSelectionDown();
        patchPasteCellAbove();
        patchPasteCellBelow();
        patchPasteCellReplace();
        patchMergeCellAbove();
        patchMergeCellBelow();
        patchSplitCell();
        patchDeleteCells();
        patchEditMode();
        patchCommandMode();
    }

    function patchCellSelect(){
        /* patch cell selection to handle highlighting */

        var oldCellSelect = Cell.Cell.prototype.select;
        Cell.Cell.prototype.select = function(){
            // if selecting a hidden cell in the main notebook
            if(this.metadata.cell_hidden ){
                // highlight the placeholder and cell in sidebar
                $('.placeholder').removeClass('active')
                $(this.element).nextAll('.placeholder').first().addClass('active')
                if(!Jupyter.sidebar.collapsed){
                    for(j=0; j < Jupyter.sidebar.cells.length; j++){
                        Jupyter.sidebar.cells[j].selected = false
                        Jupyter.sidebar.cells[j].element.removeClass('selected')
                        Jupyter.sidebar.cells[j].element.addClass('unselected')
                    }
                    if(this.sb_cell != undefined){
                        this.sb_cell.selected = true
                        this.sb_cell.element.removeClass('unselected')
                        this.sb_cell.element.addClass('selected')
                    }
                }

                oldCellSelect.apply(this, arguments);
            }
            // if selecting a cell that is not hidden
            else{
                $('.placeholder').removeClass('active')
                // make sure all placeholders are not highlighted (if sidebar is collapsed)
                if(!Jupyter.sidebar.collapsed){
                // make sure all cells in the sidebar are unselected if the sidebar is visible
                    for(j=0; j < Jupyter.sidebar.cells.length; j++){
                        Jupyter.sidebar.cells[j].selected = false
                        Jupyter.sidebar.cells[j].element.removeClass('selected')
                        Jupyter.sidebar.cells[j].element.addClass('unselected')
                    }
                }

                oldCellSelect.apply(this, arguments);
            }
        }
    }

    function patchCodeExecute(){
        // patch code cell execution to account for edits made in sidebar

        var oldCodeCellExecute = CodeCell.CodeCell.prototype.execute;
        CodeCell.CodeCell.prototype.execute = function(){
            that = this;

            function updateCellOnExecution(evt){
                that.sb_cell.fromJSON(that.toJSON())
                events.off('kernel_idle.Kernel', updateCellOnExecution)
            }

            if(this.metadata.cell_hidden){
                this.set_text(this.sb_cell.get_text())
                oldCodeCellExecute.apply(this, arguments);
                events.on('kernel_idle.Kernel', updateCellOnExecution);
            }
            else{
                oldCodeCellExecute.apply(this, arguments);
            }

        }

    }

    function patchTextRender(){
        // patch text cell redering to account for edits made in sidebar

        var oldTextCellRender = TextCell.MarkdownCell.prototype.render;
        TextCell.MarkdownCell.prototype.render = function(){
            that = this;

            if(this.metadata.cell_hidden && this.sb_cell != undefined){
                this.set_text(this.sb_cell.get_text())
                oldTextCellRender.apply(this, arguments)
                this.sb_cell.fromJSON(that.toJSON())
            }
            else{
                oldTextCellRender.apply(this, arguments)
            }
        }
    }

    function patchMoveSelectionUp(){
        var oldMoveSelectionUp = Jupyter.notebook.__proto__.move_selection_up;
        Jupyter.notebook.__proto__.move_selection_up = function(){
            oldMoveSelectionUp.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
        // We may want more complex movement behavior such as...
        // if this hidden and one above hidden
            // move up and then re-render
        // if this visible and one above visible
            // do what you normally would
        // if this hidden and one above visible
            // do nothing
        // if this visible and one above hidden
            // get whole collection of contiguous hidden cells
            // move whole collection down
    }

    function patchMoveSelectionDown(){
        var oldMoveSelectionDown = Jupyter.notebook.__proto__.move_selection_down;
        Jupyter.notebook.__proto__.move_selection_down = function(){
            oldMoveSelectionDown.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchPasteCellAbove(){
        var oldPasteCellAbove = Jupyter.notebook.__proto__.paste_cell_above;
        Jupyter.notebook.__proto__.paste_cell_above = function(){
            //ensure newly created cells have a unique janus id
            for(i=0; i<Jupyter.notebook.clipboard.length; i++){
                Jupyter.notebook.clipboard[i].metadata.janus_cell_id = Math.random().toString(16).substring(2);
            }
            oldPasteCellAbove.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchPasteCellBelow(){
        var oldPasteCellBelow = Jupyter.notebook.__proto__.paste_cell_below;
        Jupyter.notebook.__proto__.paste_cell_below = function(){
            //ensure newly created cells have a unique janus id
            for(i=0; i<Jupyter.notebook.clipboard.length; i++){
                Jupyter.notebook.clipboard[i].metadata.janus_cell_id = Math.random().toString(16).substring(2);
            }
            oldPasteCellBelow.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchPasteCellReplace(){
        var oldPasteCellReplace = Jupyter.notebook.__proto__.paste_cell_replace;
        Jupyter.notebook.__proto__.paste_cell_replace = function(){
            //ensure newly created cells have a unique janus id
            for(i=0; i<Jupyter.notebook.clipboard.length; i++){
                Jupyter.notebook.clipboard[i].metadata.janus_cell_id = Math.random().toString(16).substring(2);
            }
            oldPasteCellReplace.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchMergeCellAbove(){
        var oldMergeCellAbove = Jupyter.notebook.__proto__.merge_cell_above;
        Jupyter.notebook.__proto__.merge_cell_above = function(){
            oldMergeCellAbove.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchMergeCellBelow(){
        var oldMergeCellBelow = Jupyter.notebook.__proto__.merge_cell_below;
        Jupyter.notebook.__proto__.merge_cell_below = function(){
            oldMergeCellBelow.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchSplitCell(){
        var oldSplitCell = Jupyter.notebook.__proto__.split_cell;
        Jupyter.notebook.__proto__.split_cell = function(){
            var cell = Jupyter.notebook.get_selected_cell();
            if(cell.metadata.cell_hidden){
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
                    // sidebar cell metadata
                    new_cell.metadata = JSON.parse(JSON.stringify(cell.metadata));
                    new_cell.metadata.janus_cell_id = Math.random().toString(16).substring(2);
                }
                Jupyter.sidebar.hideIndentedCells();
            }
            else{
                oldSplitCell.apply(this, arguments);
            }
            Jupyter.sidebar.update();
        }
    }

    function patchInsertCellAtIndex(){
        // Make sure newly created cells have a unique Janus id
        var oldInsertCellAtIndex = Jupyter.notebook.__proto__.insert_cell_at_index;
        Jupyter.notebook.__proto__.insert_cell_at_index = function(){
            c = oldInsertCellAtIndex.apply(this, arguments);
            c.metadata.janus_cell_id = Math.random().toString(16).substring(2);
            c.metadata.hide_input = false;

            if(Jupyter.notebook.get_selected_cell().metadata.cell_hidden){
                c.metadata.cell_hidden = true
                Jupyter.sidebar.hideIndentedCells();
                Jupyter.sidebar.update();
            }

            return c;
        }
    }

    function patchToMarkdown(){
        var oldToMarkdown = Jupyter.notebook.__proto__.to_markdown;
        Jupyter.notebook.__proto__.to_markdown = function(){
            oldToMarkdown.apply(this, arguments);
            selected_cells = Jupyter.notebook.get_selected_cells();
            for(i=0; i<selected_cells.length; i++){
                selected_cells[i].metadata.janus_cell_id = Math.random().toString(16).substring(2);
            }
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
            if(!Jupyter.sidebar.collapsed){
                selected_cells = Jupyter.notebook.get_selected_cells();
                for(i=0; i<selected_cells.length; i++){
                    selected_cells[i].sb_cell.unrender()
                }
                selected_cells[0].sb_cell.focus_editor()
            }
        }
    }

    function patchToCode(){
        var oldToCode = Jupyter.notebook.__proto__.to_code;
        Jupyter.notebook.__proto__.to_code = function(){
            oldToCode.apply(this, arguments);
            selected_cells = Jupyter.notebook.get_selected_cells();
            for(i=0; i<selected_cells.length; i++){
                selected_cells[i].metadata.janus_cell_id = Math.random().toString(16).substring(2);
            }
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
            selected_cells[0].sb_cell.focus_editor()
        }
    }

    function patchDeleteCells(){
        var oldDeleteCells = Jupyter.notebook.__proto__.delete_cells;
        Jupyter.notebook.__proto__.delete_cells = function(){
            oldDeleteCells.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchEditMode(){
            var oldEditMode = Jupyter.notebook.__proto__.edit_mode;
            Jupyter.notebook.__proto__.edit_mode = function(){
                cell = Jupyter.notebook.get_selected_cell()
                if(cell.metadata.cell_hidden){
                    cell.sb_cell.unrender()
                    cell.sb_cell.focus_editor()
                }
                else{
                    oldEditMode.apply(this, arguments);
                }
            }
    }

    function patchCommandMode(){
            var oldCommandMode = Jupyter.notebook.__proto__.command_mode;
            Jupyter.notebook.__proto__.command_mode = function(){
                cell = Jupyter.notebook.get_selected_cell()
                if(cell.metadata.cell_hidden){
                    cell.sb_cell.code_mirror.getInputField().blur()
                }
                else{
                    oldCommandMode.apply(this, arguments);
                }
            }
    }

    return{
        applyJanusPatches: applyJanusPatches
    };
});
