/*
Janus: Jupyter Notebook Extension that assist with notebook cleaning
*/

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

    //TODO enable cell-level histories
    //TODO show cell input to the side
    //TODO enable meta-data only notebook history tracking (stretch)
    //TODO put notebook into command mode if ESC key pressed in sidebar cell
    //TODO render more informative marker of hidden cells (e.g., minimap)
    //TODO separate code into multiple files for future maintenance

    var Sidebar = function(nb){
        // A sidebar panel for showing 'indented' cells

        var sidebar = this;
        Jupyter.sidebar = sidebar;

        sidebar.notebook = nb;
        sidebar.collapsed = true;
        sidebar.cells = [];
        sidebar.placeholder = null

        // create html elements for sidebar and add to page
        sidebar.element = $('<div id=sidebar-container>');
        $("#notebook").append(sidebar.element);
    };

    Sidebar.prototype.renderWithCells = function(cells){
        // render select cells in the sidebar

        // create new cell wrapper for containing new cells
        this.cells = []
        $('#cell-wrapper').remove();
        this.element.append($("<div/>").attr('id', 'cell-wrapper').addClass('cell-wrapper'));

        // for each cell, create a new cell in the Sidebar with the same content
        for (i = 0; i < cells.length; i++){
            newCell = null
            // markdown cells
            if(cells[i].cell_type == 'markdown'){
                // create new markdown cells
                newCell = new TextCell.MarkdownCell({
                    events: this.notebook.events,
                    config: this.notebook.config,
                    keyboard_manager: this.notebook.keyboard_manager,
                    notebook: this.notebook,
                    tooltip: this.notebook.tooltip,
                });
            }
            // code cells
            else if(cells[i].cell_type == 'code'){
                // create new code cells
                newCell = new CodeCell.CodeCell(this.notebook.kernel, {
                    events: this.notebook.events,
                    config: this.notebook.config,
                    keyboard_manager: this.notebook.keyboard_manager,
                    notebook: this.notebook,
                    tooltip: this.notebook.tooltip,
                });
            }

            // populate the new cell's content based on the original cell
            cell_data = cells[i].toJSON();
            newCell.fromJSON(cell_data);
            newCell.original = cells[i]
            cells[i].duplicate = newCell

            // add cell clone to the Sidebar and list of sidebar cells
            $('#cell-wrapper').append(newCell.element);
            Jupyter.sidebar.cells.push(newCell);

            // render and focus code cells in the sidebar
            if(cells[i].cell_type == 'code'){
                newCell.render();
                newCell.focus_editor();
            }

            // intercept sidbar click events and apply them to original cell
            newCell._on_click = function(event){
                // unselect all cells in sidebar
                for(j=0; j < Jupyter.sidebar.cells.length; j++){
                    Jupyter.sidebar.cells[j].selected = false
                    Jupyter.sidebar.cells[j].element.removeClass('selected')
                    Jupyter.sidebar.cells[j].element.addClass('unselected')
                }
                // select this cell in the sidebar
                this.selected = true
                this.element.removeClass('unselected')
                this.element.addClass('selected')
                // select the appropriate cell in the original notebook
                this.events.trigger('select.Cell', {'cell':this.original, 'extendSelection':event.shiftKey});
            }

            // propigate edits back to main cell
            newCell.code_mirror.on('change', function(){
                //TODO find better way to identify cell code mirror is associated with
                selected_cell = Jupyter.notebook.get_selected_cell()
                selected_cell.set_text(selected_cell.duplicate.get_text())
            });
        }

        // focus the first cell in the sidebar
        if(cells.length > 0){
            cells[0].duplicate.element.focus();
            if(cells[0].cell_type == 'code'){
                cells[0].duplicate.focus_editor();
            }
        }

    }

    Sidebar.prototype.toggle = function(cells = []){
        // expand or collapse sidebar

        // get ids for cells to render, and cells already in sidebar
        new_cell_ids = []
        old_cell_ids = []
        for(i=0; i<cells.length; i++){
            new_cell_ids.push(cells[i].metadata.janus_cell_id)
        }
        for(j=0; j<this.cells.length; j++){
            old_cell_ids.push(this.cells[j].metadata.janus_cell_id)
        }

        // expand sidebar if collapsed
        if(this.collapsed){
            this.expand(cells)
            $('.placeholder').removeClass('showing')
            $(this.placeholder).addClass('showing')
        }
        // update sidebar with new cells if needed (using hacky array comparison)
        else if(JSON.stringify(old_cell_ids) != JSON.stringify(new_cell_ids)){
            var placeholder_height = $(this.placeholder).position().top

            this.element.animate({
                top: placeholder_height - 12,
            }, 400, function(){
                if(cells.length > 0){
                    Jupyter.sidebar.renderWithCells(cells)
                }
            })
            $('.placeholder').removeClass('showing')
            $(this.placeholder).addClass('showing')
        }
        // collapse sidebar if expanded and rendering same cells
        else{
            this.collapse()
            $('.placeholder').removeClass('showing')
        }
    }

    Sidebar.prototype.expand = function(cells = []){
        $('#cell-wrapper').show()
        if(this.collapsed){
            that = this
            this.collapsed = false;

            var site_height = $("#site").height();
            var site_width = $("#site").width();
            var notebook_width = $("#notebook-container").width();
            var sidebar_width = (site_width - 45) / 2

            $("#notebook-container").animate({
                marginLeft: '15px',
                width: sidebar_width
            }, 400, function(){
                var placeholder_height = $(Jupyter.sidebar.placeholder).position().top

                Jupyter.sidebar.element.animate({
                    right: '15px',
                    width: sidebar_width,
                    top: placeholder_height - 12,
                    padding: '0px'
                }, 400, function(){
                    if(cells.length > 0){
                        Jupyter.sidebar.renderWithCells(cells)
                    }
                })
            })
        }
    };

    Sidebar.prototype.collapse = function(){
        this.collapsed = true;

        var menubar_width = $("#menubar-container").width();
        var site_width = $("#site").width();
        var margin = (site_width - menubar_width) / 2

        $("#notebook-container").animate({
            marginLeft: margin,
            width: menubar_width
        }, 400, function(){
            $("#notebook-container").css(
                'margin-left', 'auto'
            )
            $("#notebook-container").css(
                'width', ''
            )
        })

        this.element.animate({
            right: '15px',
            width: 0,
            padding: '0px'
        }, 250);

        $('#cell-wrapper').hide()
    };

    Sidebar.prototype.update = function(){
        if(!this.collapsed){
            // get list of previous cells in sidebar and currently hidden cells
            nb_cells = Jupyter.notebook.get_cells()
            old_cell_ids = []
            hidden_cell_ids = []

            for(j=0; j<this.cells.length; j++){
                old_cell_ids.push(this.cells[j].metadata.janus_cell_id)
            }
            for(i=0; i<nb_cells.length; i++){
                if(nb_cells[i].metadata.cell_hidden){
                    hidden_cell_ids.push(nb_cells[i].metadata.janus_cell_id)
                }
            }

            // find the first hidden cell that was in our previous sidebar
            var first_hidden = null
            for(k=0; k<hidden_cell_ids.length; k++){
                if(old_cell_ids.indexOf(hidden_cell_ids[k] >= 0)){
                    first_hidden = hidden_cell_ids[k]
                    break
                }
            }

            // if none found, then collapse the sidebar
            if(first_hidden == null){
                this.collapse()
            }
            // else update the sidebar
            else{
                // get placeholder with
                placeholders = $('.placeholder').toArray()
                for(i=0; i<placeholders.length; i++){
                    if($(placeholders[i]).data('ids').indexOf(first_hidden) >= 0){
                        Jupyter.sidebar.placeholder = placeholders[i];
                        showSidebarWithCells($(placeholders[i]).data('ids'))
                        break
                    }
                }
            }
        }
    }

    function createSidebar() {
        // create a new sidebar element
        return new Sidebar(Jupyter.notebook);
    }

    function load_css() {
        // Load css for sidebar
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = require.toUrl("./main.css");
        document.getElementsByTagName("head")[0].appendChild(link);
    };

    function renderJanusMenu(){
        // add menu items for indenting and unindenting cells
        var editMenu = $('#edit_menu');

        editMenu.append($('<li>')
            .addClass('divider')
        );

        editMenu.append($('<li>')
            .attr('id', 'toggle_cell_input')
            .append($('<a>')
                .attr('href', '#')
                .text('Toggle Cell Input')
                .click(toggleInput)
            )
        );

        editMenu.append($('<li>')
            .addClass('divider')
        );

        editMenu.append($('<li>')
            .attr('id', 'indent_cell')
            .append($('<a>')
                .attr('href', '#')
                .text('Indent Cell')
                .click(indentCell)
            )
        );

        editMenu.append($('<li>')
            .attr('id', 'unindent_cell')
            .append($('<a>')
                .attr('href', '#')
                .text('Unindent Cell')
                .click(unindentCell)
            )
        );
    }

    function renderJanusButtons() {
        // add buttons to toolbar fo hiding and showing cells
        var toggleInputAction = {
            icon: 'fa-code',
            help    : 'Toggle Input',
            help_index : 'zz',
            handler : toggleInput
        };

        var indentAction = {
            icon: 'fa-indent',
            help    : 'Indent cells',
            help_index : 'zz',
            handler : indentCell
        };

        var unindentAction = {
            icon: 'fa-outdent',
            help    : 'Unindent cells',
            help_index : 'zz',
            handler : unindentCell
        };

        var prefix = 'janus';
        var toggle_input_name = 'toggle-cell-input'
        var indent_action_name = 'indent-cell';
        var unindent_action_name = 'unindent-cell';

        var full_toggle_action_name = Jupyter.actions.register(toggleInputAction,
                                                            toggle_input_name,
                                                            prefix);

        var full_indent_action_name = Jupyter.actions.register(indentAction,
                                                            indent_action_name,
                                                            prefix);
        var full_unindent_action_name = Jupyter.actions.register(unindentAction,
                                                            unindent_action_name,
                                                            prefix);
        Jupyter.toolbar.add_buttons_group([full_toggle_action_name]).find('.btn').attr('id', 'btn-hide-input');;
        Jupyter.toolbar.add_buttons_group([full_indent_action_name, full_unindent_action_name]);
    }

    function patchCellSelect(){
        // patch cell selection to handle highlighting

        console.log('[Janus] Patching Cell Selection')
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
                    if(this.duplicate != undefined){
                        this.duplicate.selected = true
                        this.duplicate.element.removeClass('unselected')
                        this.duplicate.element.addClass('selected')
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

            if(this.metadata.hide_input){
                $('#btn-hide-input').css(
                    'background-color', '#eee'
                )
            }
            else{
                $('#btn-hide-input').css(
                    'background-color', '#fff'
                )
            }
        }
    }

    function patchCodeExecute(){
        // patch code cell execution to account for edits made in sidebar

        console.log('[Janus] Patching Code Cell Execute')
        var oldCodeCellExecute = CodeCell.CodeCell.prototype.execute;
        CodeCell.CodeCell.prototype.execute = function(){
            that = this;

            function updateCellOnExecution(evt){
                that.duplicate.fromJSON(that.toJSON())
                events.off('kernel_idle.Kernel', updateCellOnExecution)
            }

            if(this.metadata.cell_hidden){
                this.set_text(this.duplicate.get_text())
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

        console.log('[Janus] Patching Text Cell Render')
        var oldTextCellRender = TextCell.MarkdownCell.prototype.render;
        TextCell.MarkdownCell.prototype.render = function(){
            that = this;

            if(this.metadata.cell_hidden && this.duplicate != undefined){
                this.set_text(this.duplicate.get_text())
                oldTextCellRender.apply(this, arguments)
                this.duplicate.fromJSON(that.toJSON())
            }
            else{
                oldTextCellRender.apply(this, arguments)
            }
        }
    }

    function patchMoveSelectionUp(){
        console.log('[Janus] Patching Move Selection Up')
        var oldMoveSelectionUp = Jupyter.notebook.__proto__.move_selection_up;
        Jupyter.notebook.__proto__.move_selection_up = function(){
            oldMoveSelectionUp.apply(this, arguments);
            hideIndentedCells();
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
        console.log('[Janus] Patching Move Selection Down')
        var oldMoveSelectionDown = Jupyter.notebook.__proto__.move_selection_down;
        Jupyter.notebook.__proto__.move_selection_down = function(){
            oldMoveSelectionDown.apply(this, arguments);
            hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchPasteCellAbove(){
        console.log('[Janus] Patching Paste Cell Above')
        var oldPasteCellAbove = Jupyter.notebook.__proto__.paste_cell_above;
        Jupyter.notebook.__proto__.paste_cell_above = function(){
            //ensure newly created cells have a unique janus id
            for(i=0; i<Jupyter.notebook.clipboard.length; i++){
                Jupyter.notebook.clipboard[i].metadata.janus_cell_id = Math.random().toString(16).substring(2);
            }
            oldPasteCellAbove.apply(this, arguments);
            hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchPasteCellBelow(){
        console.log('[Janus] Patching Paste Cell Below')
        var oldPasteCellBelow = Jupyter.notebook.__proto__.paste_cell_below;
        Jupyter.notebook.__proto__.paste_cell_below = function(){
            //ensure newly created cells have a unique janus id
            for(i=0; i<Jupyter.notebook.clipboard.length; i++){
                Jupyter.notebook.clipboard[i].metadata.janus_cell_id = Math.random().toString(16).substring(2);
            }
            oldPasteCellBelow.apply(this, arguments);
            hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchPasteCellReplace(){
        console.log('[Janus] Patching Paste Cell Replace')
        var oldPasteCellReplace = Jupyter.notebook.__proto__.paste_cell_replace;
        Jupyter.notebook.__proto__.paste_cell_replace = function(){
            //ensure newly created cells have a unique janus id
            for(i=0; i<Jupyter.notebook.clipboard.length; i++){
                Jupyter.notebook.clipboard[i].metadata.janus_cell_id = Math.random().toString(16).substring(2);
            }
            oldPasteCellReplace.apply(this, arguments);
            hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchMergeCellAbove(){
        console.log('[Janus] Patching Merge Cell Above')
        var oldMergeCellAbove = Jupyter.notebook.__proto__.merge_cell_above;
        Jupyter.notebook.__proto__.merge_cell_above = function(){
            oldMergeCellAbove.apply(this, arguments);
            hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchMergeCellBelow(){
        console.log('[Janus] Patching Paste Cell Replace')
        var oldMergeCellBelow = Jupyter.notebook.__proto__.merge_cell_above;
        Jupyter.notebook.__proto__.merge_cell_above = function(){
            oldMergeCellBelow.apply(this, arguments);
            hideIndentedCells();
            Jupyter.sidebar.update();
        }
    }

    function patchSplitCell(){
        console.log('[Janus] Patching Split Cell')
        var oldSplitCell = Jupyter.notebook.__proto__.split_cell;
        Jupyter.notebook.__proto__.split_cell = function(){
            var cell = Jupyter.notebook.get_selected_cell();
            if(cell.metadata.cell_hidden){
                if (cell.duplicate.is_splittable()) {
                    var texta = cell.duplicate.get_pre_cursor();
                    var textb = cell.duplicate.get_post_cursor();
                    // current cell becomes the second one
                    // so we don't need to worry about selection
                    cell.set_text(textb);
                    // create new cell with same type
                    var new_cell = Jupyter.notebook.insert_cell_above(cell.cell_type);
                    // Unrender the new cell so we can call set_text.
                    new_cell.unrender();
                    new_cell.set_text(texta);
                    // duplicate metadata
                    new_cell.metadata = JSON.parse(JSON.stringify(cell.metadata));
                    new_cell.metadata.janus_cell_id = Math.random().toString(16).substring(2);
                }
                hideIndentedCells();
            }
            else{
                oldSplitCell.apply(this, arguments);
            }
            Jupyter.sidebar.update();
        }
    }

    function patchInsertCellAtIndex(){
        // Make sure newly created cells have a unique Janus id

        console.log('[Janus] Patching Insert Cell')
        var oldInsertCellAtIndex = Jupyter.notebook.__proto__.insert_cell_at_index;
        Jupyter.notebook.__proto__.insert_cell_at_index = function(){
            c = oldInsertCellAtIndex.apply(this, arguments);
            c.metadata.janus_cell_id = Math.random().toString(16).substring(2);
            c.metadata.hide_input = false;
            return c;
        }
    }

    function hideIndentedCells(){
        // hide all indented cells and render placeholders in their place

        $(".placeholder").remove()

        cells = Jupyter.notebook.get_cells();
        serial_hidden_cells = []

        for(i = 0; i < cells.length; i++){
            // make sure all cells have the right metadata
            if (cells[i].metadata.cell_hidden === undefined){
                cells[i].metadata.cell_hidden = false;
            }
            // make sure all cells have a unique Janus id
            if (cells[i].metadata.janus_cell_id === undefined){
                cells[i].metadata.janus_cell_id = Math.random().toString(16).substring(2);
            }

            // keep track of groups of hidden cells
            if(cells[i].metadata.cell_hidden){
                serial_hidden_cells.push(cells[i])
                if(i == cells.length - 1){
                    cell_ids = []
                    for(j = 0; j < serial_hidden_cells.length; j++){
                        serial_hidden_cells[j].element.addClass('hidden');
                        cell_ids.push(serial_hidden_cells[j].metadata.janus_cell_id);
                    }
                    // create placeholder that will render this group of hidden cells
                    addPlaceholderAfterElementWithIds(serial_hidden_cells[serial_hidden_cells.length - 1].element, cell_ids)

                    serial_hidden_cells = []
                }
            }
            else{
                // if this cell is visible but preceeded by a hidden cell
                if(serial_hidden_cells.length > 0){
                    // hide the previously cells and get a list of their ids
                    cell_ids = []
                    for(j = 0; j < serial_hidden_cells.length; j++){
                        serial_hidden_cells[j].element.addClass('hidden');
                        cell_ids.push(serial_hidden_cells[j].metadata.janus_cell_id);
                    }
                    // create placeholder that will render this group of hidden cells
                    addPlaceholderAfterElementWithIds(serial_hidden_cells[serial_hidden_cells.length - 1].element, cell_ids)

                    serial_hidden_cells = []
                }
            }
        }
    }

    function toggleInput(){
        var cell = Jupyter.notebook.get_selected_cell();
        // Toggle visibility of the input div
        cell.element.find("div.input").toggle('slow');
        cell.metadata.hide_input =! cell.metadata.hide_input;

        if(cell.metadata.hide_input){
            $('#btn-hide-input').css(
                'background-color', '#eee'
            )
        }
        else{
            $('#btn-hide-input').css(
                'background-color', '#fff'
            )
        }
    }

    function updateInputVisibility() {
        Jupyter.notebook.get_cells().forEach(function(cell) {
            // ensure each cell has this metadata
            if(cell.metadata.hide_input == undefined){
                cell.metadata.hide_input = false;
            }
            // hide cells if needed
            if (cell.metadata.hide_input) {
                cell.element.find("div.input").hide();
            }
        })
    };

    function indentCell(){
        cells = Jupyter.notebook.get_selected_cells();

        // find where the selected cells are in the notebook
        all_cells = Jupyter.notebook.get_cells()
        sel_start_id = all_cells.indexOf(cells[0])
        sel_end_id = all_cells.indexOf(cells[cells.length - 1])
        start_id = all_cells.indexOf(cells[0])
        end_id = all_cells.indexOf(cells[cells.length - 1])

        // check if the prior cell(s) is/are already hidden
        while(start_id > 0){
            if(all_cells[start_id - 1].metadata.cell_hidden == true){
                start_id = start_id -1
            }
            else{
                break
            }
        }

        // check if the next cell(s) is/are already hidden
        while(end_id < all_cells.length - 1){
            if(all_cells[end_id + 1].metadata.cell_hidden == true){
                end_id = end_id + 1
            }
            else{
                break
            }
        }

        // get rid of the existing placeholder divs in our selection
        start_element = all_cells[start_id].element
        end_element = $(all_cells[end_id].element).next()
        contained_placeholders = $(start_element).nextUntil(end_element).add(end_element).filter('div.placeholder')
        $(contained_placeholders).remove()

        // get the whole expanded selection of hidden cells_to_copy
        hidden_cells = all_cells.slice(start_id, end_id+1)
        cell_ids = []

        // set the metadata and hide cells
        for(i=0; i < hidden_cells.length; i++){
            hidden_cells[i].metadata.cell_hidden = true;
            hidden_cells[i].element.addClass('hidden');
            cell_ids.push(hidden_cells[i].metadata.janus_cell_id)
        }

        // put placeholder div immediatley after it
        addPlaceholderAfterElementWithIds(hidden_cells[hidden_cells.length - 1].element, cell_ids)
        Jupyter.sidebar.update()
    }

    function addPlaceholderAfterElementWithIds(elem, cell_ids){
        elem.after($('<div>')
            .addClass('placeholder')
            .data('ids', cell_ids.slice())
            .click(function(){
                Jupyter.sidebar.placeholder = this;
                showSidebarWithCells($(this).data('ids'))
            })
            .text(`${cell_ids.length}`))
    }

    function showSidebarWithCells(cell_ids){
        // get the cells we should show
        cells = Jupyter.notebook.get_cells()
        cells_to_copy = []
        for(i=0; i<cells.length; i++){
            if ( $.inArray( cells[i].metadata.janus_cell_id, cell_ids ) > -1 ){
                cells_to_copy.push(cells[i])
            }
        }

        Jupyter.sidebar.toggle(cells_to_copy)
    }

    function unindentCell(){
        // move selected cells back to main notebook

        cells = Jupyter.notebook.get_selected_cells();

        // make hidden cells visible
        for(i=0; i<cells.length; i++){
            cells[i].element.removeClass('hidden')
            cells[i].metadata.cell_hidden = false
            cells[i].set_text(cells[i].duplicate.get_text())
            cells[i].render()
        }

        // remove any hidden cells from the sidebar
        for(j=0; j<Jupyter.sidebar.cells.length; j++){
            if(Jupyter.sidebar.cells[j].selected){
                Jupyter.sidebar.cells[j].element.addClass('hidden')
                Jupyter.sidebar.cells[j].element.remove()
                Jupyter.sidebar.cells.splice(i, 1)
            }
        }

        hideIndentedCells()
        Jupyter.sidebar.update()
    }

    function load_extension(){
        /* Called as extension loads and notebook opens */
        console.log('[Janus] is working');
        load_css();
        renderJanusMenu();
        renderJanusButtons();
        createSidebar();
        patchCellSelect();
        patchCodeExecute();
        patchInsertCellAtIndex();
        patchTextRender();
        patchMoveSelectionUp();
        patchMoveSelectionDown();
        patchPasteCellAbove();
        patchPasteCellBelow();
        patchPasteCellReplace();
        patchMergeCellAbove();
        patchMergeCellBelow();
        patchSplitCell();

        if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
            // notebook already loaded. Update directly
            hideIndentedCells();
            updateInputVisibility();
        }

        events.on("notebook_loaded.Notebook", hideIndentedCells);
        events.on("notebook_loaded.Notebook", updateInputVisibility);
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
