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

    //TODO if ESC key pressed when sidebar cell in edit mode, put notebook into
    // command mode
    //TODO update code and text cells when input is edited but not rendered/executed
    //TODO render more informative marker of hidden cells (e.g., minimap)

    var Sidebar = function(nb){
        // A sidebar panel for showing 'indented' cells

        var sidebar = this;
        Jupyter.sidebar = sidebar;

        sidebar.notebook = nb;
        sidebar.collapsed = true;
        sidebar.cells = [];
        sidebar.placeholder = null

        // create html elements for sidebar
        sidebar.element = $('<div id=sidebar-container>');
        sidebar.close_button = $("<i>").addClass("fa fa-caret-right sidebar-btn");

        // hook up button click event
        sidebar.close_button.click(function(){
            sidebar.collapse();
        });

        // add the Sidebar the page
        sidebar.element.append(sidebar.close_button);
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
                top: placeholder_height - 15,
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
            this.collapsed = false;

            var site_height = $("#site").height();
            var site_width = $("#site").width();
            var notebook_width = $("#notebook-container").width();
            var sidebar_width = (site_width - 45) / 2
            var placeholder_height = $(this.placeholder).position().top

            $("#notebook-container").animate({
                marginLeft: '15px',
                width: sidebar_width
            }, 400)

            this.element.animate({
                right: '15px',
                width: sidebar_width,
                top: placeholder_height - 15,
                padding: '0px'
            }, 400, function(){
                if(cells.length > 0){
                    Jupyter.sidebar.renderWithCells(cells)
                }
            })

            this.close_button.show();
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

        this.close_button.hide();
        $('#cell-wrapper').hide()
    };

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
        var indent_action_name = 'indent-cell';
        var unindent_action_name = 'unindent-cell';

        var full_indent_action_name = Jupyter.actions.register(indentAction,
                                                            indent_action_name,
                                                            prefix);
        var full_unindent_action_name = Jupyter.actions.register(unindentAction,
                                                            unindent_action_name,
                                                            prefix);
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
                $(this.element).nextAll('.placeholder').first().addClass('showing')
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
                // make sure all placeholders are not highlighted (if sidebar is collapsed)
                if(Jupyter.sidebar.collapsed){
                    $('.placeholder').removeClass('showing')
                }
                // make sure all cells in the sidebar are unselected if the sidebar is visible
                else{
                    for(j=0; j < Jupyter.sidebar.cells.length; j++){
                        Jupyter.sidebar.cells[j].selected = false
                        Jupyter.sidebar.cells[j].element.removeClass('selected')
                        Jupyter.sidebar.cells[j].element.addClass('unselected')
                    }
                    $('.placeholder').removeClass('showing')
                    $(Jupyter.sidebar.placeholder).addClass('showing')
                }

                oldCellSelect.apply(this, arguments);
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
            console.log('executing new code')
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

    function patchInsertCellAtIndex(){
        // Make sure newly created cells have a unique Janus id

        console.log('[Janus] Patching Insert Cell')
        var oldInsertCellAtIndex = Jupyter.notebook.__proto__.insert_cell_at_index;
        Jupyter.notebook.__proto__.insert_cell_at_index = function(){
            c = oldInsertCellAtIndex.apply(this, arguments);
            c.metadata.janus_cell_id = Math.random().toString(16).substring(2);
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
        }

        // remove any hidden cells from the sidebar
        for(j=0; j<Jupyter.sidebar.cells.length; j++){
            if(Jupyter.sidebar.cells[j].selected){
                Jupyter.sidebar.cells[j].element.addClass('hidden')
            }
        }

        hideIndentedCells()
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
        hideIndentedCells();
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
