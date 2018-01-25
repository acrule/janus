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

    function applyJanusPatches(){
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

    function patchCellSelect(){
        /* patch cell selection to handle sidebar highlighting */
        var oldCellSelect = Cell.Cell.prototype.select;
        Cell.Cell.prototype.select = function(){
            // if selecting a hidden cell
            if(this.metadata.janus.cell_hidden){
                // highlight the associated placeholder
                //$('.indent-marker').removeClass('active')
                $(this.element).nextAll('.indent-marker').first().addClass('active')

                // attempted more robust selection of associate placeholder, but
                // led to notebook freezing (unbounded for loop?)
                // placeholders = $('.indent-marker').toArray()
                // janus_id = this.metadata.cell_id
                // for(i=0; i<placeholders.length; i++){
                //     if($(placeholders[i]).data('ids').indexOf(janus_id) >= 0){
                //         $(placeholders[i]).addClass('active')
                //     }
                // }

                // select the corresponding cell in the sidebar, if visible
                if(!Jupyter.sidebar.collapsed){
                    sb_cells = Jupyter.sidebar.cells
                    for(j=0; j < sb_cells.length; j++){
                        unselectSidebarCell(sb_cells[j])
                    }
                    if(this.sb_cell != undefined){
                        selectSidebarCell(this.sb_cell)
                    }
                }
            }
            // if selecting a cell visible in the notebook
            else{
                // make sure all placeholders are not highlighted
                //$('.indent-marker').removeClass('active')

                // unselect the corresponding cell in the sidebar, if visible
                if(!Jupyter.sidebar.collapsed){
                    sb_cells = Jupyter.sidebar.cells
                    for(j=0; j < sb_cells.length; j++){
                        unselectSidebarCell(sb_cells[j])
                    }
                }
            }

            // either way, do the normal cell selection
            oldCellSelect.apply(this, arguments);
        }
    }

    function selectSidebarCell(cell){
        /* manage classes and variable to select sidebar cell */
        cell.selected = true
        cell.element.removeClass('unselected')
        cell.element.addClass('selected')
    }

    function unselectSidebarCell(cell){
        /* manage classes and variable to unselect sidebar cell */
        cell.selected = false
        cell.element.removeClass('selected')
        cell.element.addClass('unselected')
    }

    function patchCodeExecute(){
        /* execute main cell using sidebar text, then update sidebar cell */
        var oldCodeCellExecute = CodeCell.CodeCell.prototype.execute;
        CodeCell.CodeCell.prototype.execute = function(){
            that = this;

            function updateCellOnExecution(evt){
                that.sb_cell.fromJSON(that.toJSON())
                JanusHistory.render_markers(that.sb_cell)
                events.off('kernel_idle.Kernel', updateCellOnExecution)
            }

            if(this.metadata.janus.cell_hidden || this.metadata.janus.source_hidden){
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
        /* render main cell using sidebar text, then update sidebar cell */
        var oldTextCellRender = TextCell.MarkdownCell.prototype.render;
        TextCell.MarkdownCell.prototype.render = function(){
            if(this.metadata.janus == undefined){
                generateDefaultJanusMetadata(this)
            }

            if(this.metadata.janus.cell_hidden && this.sb_cell != undefined){
                this.set_text(this.sb_cell.get_text())
                oldTextCellRender.apply(this, arguments)
                this.sb_cell.fromJSON(this.toJSON())
            }
            else{
                oldTextCellRender.apply(this, arguments)
            }
        }
    }

    function patchMoveSelectionUp(){
        /* Update sidebar after the move */
        var oldMoveSelectionUp = Jupyter.notebook.__proto__.move_selection_up;
        Jupyter.notebook.__proto__.move_selection_up = function(){
            oldMoveSelectionUp.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchMoveSelectionDown(){
        /* Update sidebar after the move */
        var oldMoveSelectionDown = Jupyter.notebook.__proto__.move_selection_down;
        Jupyter.notebook.__proto__.move_selection_down = function(){
            oldMoveSelectionDown.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchMergeCellAbove(){
        /* Update sidebar after the merge */
        var oldMergeCellAbove = Jupyter.notebook.__proto__.merge_cell_above;
        Jupyter.notebook.__proto__.merge_cell_above = function(){
            oldMergeCellAbove.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchMergeCellBelow(){
        /* Update sidebar after the merge */
        var oldMergeCellBelow = Jupyter.notebook.__proto__.merge_cell_below;
        Jupyter.notebook.__proto__.merge_cell_below = function(){
            oldMergeCellBelow.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchDeleteCells(){
        /* Update sidebar after the deletion */
        var oldDeleteCells = Jupyter.notebook.__proto__.delete_cells;
        Jupyter.notebook.__proto__.delete_cells = function(){
            oldDeleteCells.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchPasteCellAbove(){
        /* ensure pasted cells have a unique janus id and sidebar updates */
        var oldPasteCellAbove = Jupyter.notebook.__proto__.paste_cell_above;
        Jupyter.notebook.__proto__.paste_cell_above = function(){
            for(i=0; i<Jupyter.notebook.clipboard.length; i++){
                Jupyter.notebook.clipboard[i].metadata.janus.cell_id = Math.random().toString(16).substring(2);
            }
            oldPasteCellAbove.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchPasteCellBelow(){
        /* ensure pasted cells have a unique janus id and sidebar updates */
        var oldPasteCellBelow = Jupyter.notebook.__proto__.paste_cell_below;
        Jupyter.notebook.__proto__.paste_cell_below = function(){
            //ensure newly created cells have a unique janus id
            for(i=0; i<Jupyter.notebook.clipboard.length; i++){
                Jupyter.notebook.clipboard[i].metadata.janus.cell_id = Math.random().toString(16).substring(2);
            }
            oldPasteCellBelow.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchPasteCellReplace(){
        /* ensure pasted cells have a unique janus id and sidebar updates */
        var oldPasteCellReplace = Jupyter.notebook.__proto__.paste_cell_replace;
        Jupyter.notebook.__proto__.paste_cell_replace = function(){
            //ensure newly created cells have a unique janus id
            for(i=0; i<Jupyter.notebook.clipboard.length; i++){
                Jupyter.notebook.clipboard[i].metadata.janus.cell_id = Math.random().toString(16).substring(2);
            }
            oldPasteCellReplace.apply(this, arguments);
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchSplitCell(){
        /* ensure split cells have a unique janus id and sidebar updates */
        var oldSplitCell = Jupyter.notebook.__proto__.split_cell;
        Jupyter.notebook.__proto__.split_cell = function(){
            var cell = Jupyter.notebook.get_selected_cell();
            if(cell.metadata.janus.cell_hidden){
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
                    new_cell.metadata.janus = JSON.parse(JSON.stringify(cell.metadata.janus));
                    new_cell.metadata.janus.cell_id = Math.random().toString(16).substring(2);
                }
                Jupyter.sidebar.hideIndentedCells();
                Jupyter.sidebar.update();
            }
            else{
                oldSplitCell.apply(this, arguments);
            }
        }
    }

    function patchInsertCellAtIndex(){
        /* ensure new cells have a unique janus id and sidebar updates */
        var oldInsertCellAtIndex = Jupyter.notebook.__proto__.insert_cell_at_index;
        Jupyter.notebook.__proto__.insert_cell_at_index = function(){
            c = oldInsertCellAtIndex.apply(this, arguments);
            generateDefaultJanusMetadata(c);
            currentCellMetadata = Jupyter.notebook.get_selected_cell().metadata
            // if creating a new cell after a hidden one, make new cell hidden
            if(currentCellMetadata.janus.cell_hidden){
                c.metadata.janus.cell_hidden = true
                Jupyter.sidebar.hideIndentedCells();
                Jupyter.sidebar.update();
            }
            return c;
        }
    }

    function patchToMarkdown(){
        /* ensure new cells have a unique janus id and sidebar updates */
        var oldToMarkdown = Jupyter.notebook.__proto__.to_markdown;
        Jupyter.notebook.__proto__.to_markdown = function(){
            oldToMarkdown.apply(this, arguments);
            selected_cells = Jupyter.notebook.get_selected_cells();
            for(i=0; i<selected_cells.length; i++){
                selected_cells[i].metadata.janus.cell_id = Math.random().toString(16).substring(2);
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
        /* ensure new cells have a unique janus id and sidebar updates */
        var oldToCode = Jupyter.notebook.__proto__.to_code;
        Jupyter.notebook.__proto__.to_code = function(){
            oldToCode.apply(this, arguments);
            selected_cells = Jupyter.notebook.get_selected_cells();
            for(i=0; i<selected_cells.length; i++){
                selected_cells[i].metadata.janus.cell_id = Math.random().toString(16).substring(2);
            }
            Jupyter.sidebar.hideIndentedCells();
            Jupyter.sidebar.update();
            selected_cells[0].sb_cell.focus_editor()
        }
    }

    function patchEditMode(){
        /* handle going to edit mode when sidebar cell is selected */
        var oldEditMode = Jupyter.notebook.__proto__.edit_mode;
        Jupyter.notebook.__proto__.edit_mode = function(){
            cell = Jupyter.notebook.get_selected_cell()
            if(cell.metadata.janus.cell_hidden){
                cell.sb_cell.unrender()
                cell.sb_cell.focus_editor()
            }
            else{
                oldEditMode.apply(this, arguments);
            }
        }
    }

    function patchCommandMode(){
        /* handle going to command mode when sidebar cell is selected */
        var oldCommandMode = Jupyter.notebook.__proto__.command_mode;
        Jupyter.notebook.__proto__.command_mode = function(){
            cell = Jupyter.notebook.get_selected_cell()
            if(cell.metadata.janus.cell_hidden){
                cell.sb_cell.code_mirror.getInputField().blur()
            }
            else{
                oldCommandMode.apply(this, arguments);
            }
        }
    }

    function generateDefaultJanusMetadata(cell){
        /* generate default Janus metadata for a cell */
        if(cell.metadata.janus == undefined){
            id = Math.random().toString(16).substring(2);
            cell_hidden = false;
            source_hidden = false;
            outputs_hidden = false;
            track_versions = false;
            versions = [];
            current_version = 0;
            cell.metadata.janus = {
                'id': id,
                'cell_hidden': cell_hidden,
                'source_hidden': source_hidden,
                'ouputs_hidden': outputs_hidden,
                'track_versions': track_versions,
                'versions_showing': false,
                'versions': versions,
                'current_version': current_version
            }
        }
    }

    function initializeJanusMetadata(){
        /* ensure all notebook cells have Janus metadata */

        Notebook = Jupyter.notebook

        // flag whether we want to track a full history of the notebook
        if (Notebook.metadata.track_history === undefined){
            Notebook.metadata.track_history = true;
        }

        // track previous names of the notebook to maintain full history
        if (Notebook.metadata.filepaths === undefined){
            Notebook.metadata.filepaths = [];
        }

        // make sure each cell has the relevant metadata
        cells = Jupyter.notebook.get_cells();
        for(i=0; i<cells.length; i++){
            generateDefaultJanusMetadata(cells[i]);
        }
    }

    return{
        applyJanusPatches: applyJanusPatches,
        generateDefaultJanusMetadata: generateDefaultJanusMetadata,
        initializeJanusMetadata: initializeJanusMetadata
    };
});
