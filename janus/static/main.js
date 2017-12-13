/*
Janus: Jupyter Notebook Extension that assist with notebook cleaning
*/

define([
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/events',
    'base/js/utils',
    'notebook/js/codecell',
    'notebook/js/textcell'
], function(
    require,
    $,
    Jupyter,
    events,
    utils,
    CodeCell,
    TextCell
){

    //TODO on sidebar cell being focused, focus the hidden cell, show indication
    // sidebar cell being selected
    //TODO patch cell selection in regular notebook to handle selecting sidebar cells
    //TODO highlight marker when shown in sidebar
    //TODO render more informative marker of hidden cells (e.g., minimap)

    var Sidebar = function(nb){
        // A sidebar panel for 'hiding' implementation details

        var sidebar = this;
        this.notebook = nb;
        this.collapsed = true;
        this.cells = []
        Jupyter.sidebar = sidebar

        // create html elements for sidebar and buttons
        this.element = $('<div id=sidebar-container>');
        this.close_button = $("<i>").addClass("fa fa-caret-square-o-right sidebar-btn sidebar-close");
        this.open_button = $("<i>").addClass("fa fa-caret-square-o-left sidebar-btn sidebar-open");
        this.element.append(this.close_button);
        this.element.append(this.open_button);

        // hook up button events
        this.open_button.click(function () {
            sidebar.expand();
            //sidebar.typeset(this.notebook, cells = []);
        });
        this.close_button.click(function () {
            sidebar.collapse();
            $('#cell-wrapper').hide()
        });

        // finally, add the Sidebar the page
        $("#notebook").append(this.element);

    };

    Sidebar.prototype.typeset = function(cells){
        // clear cell wrapper
        $('#cell-wrapper').remove();
        this.element.append($("<div/>").attr('id', 'cell-wrapper').addClass('cell-wrapper'));
        Jupyter.sidebar.cells = []

        // create a new cell in the Sidebar with the same content
        for (i = 0; i < cells.length; i++){
            if(cells[i].cell_type == 'markdown'){
                // create new markdown cells
                newCell = new TextCell.MarkdownCell({
                    events: this.notebook.events,
                    config: this.notebook.config,
                    keyboard_manager: this.notebook.keyboard_manager,
                    notebook: this.notebook,
                    tooltip: this.notebook.tooltip,
                });

                cell_data = cells[i].toJSON();
                newCell.fromJSON(cell_data);
                newCell.original = cells[i]
                cells[i].duplicate = newCell

                newCell._on_click = function(event){
                    // unselect all cells in sidebar
                    for(j=0; j < Jupyter.sidebar.cells.length; j++){
                        Jupyter.sidebar.cells[j].selected = false
                        Jupyter.sidebar.cells[j].element.removeClass('selected')
                        Jupyter.sidebar.cells[j].element.addClass('unselected')
                    }

                    // change this one to being selected
                    this.selected = true
                    this.element.removeClass('unselected')
                    this.element.addClass('selected')

                    // select the cell in the origional notebook
                    this.events.trigger('select.Cell', {'cell':this.original, 'extendSelection':event.shiftKey});
                }

                // add markdown cell to the Sidebar
                $('#cell-wrapper').append(newCell.element);
                Jupyter.sidebar.cells.push(newCell);
            }
            //TODO make sure to handle all needed steps as shown in
            // https://github.com/minrk/nbextension-scratchpad/blob/master/main.js
            else if(cells[i].cell_type == 'code'){
                // create new markdown cells
                newCell = new CodeCell.CodeCell(this.notebook.kernel, {
                    events: this.notebook.events,
                    config: this.notebook.config,
                    keyboard_manager: this.notebook.keyboard_manager,
                    notebook: this.notebook,
                    tooltip: this.notebook.tooltip,
                });

                cell_data = cells[i].toJSON();
                newCell.fromJSON(cell_data);
                newCell.original = cells[i]
                cells[i].duplicate = newCell

                // intercept on click events
                // later may want to subclass CodeCells for cleaner code
                newCell._on_click = function(event){
                    // unselect all cells in sidebar
                    for(j=0; j < Jupyter.sidebar.cells.length; j++){
                        Jupyter.sidebar.cells[j].selected = false
                        Jupyter.sidebar.cells[j].element.removeClass('selected')
                        Jupyter.sidebar.cells[j].element.addClass('unselected')
                    }

                    // change this one to being selected
                    this.selected = true
                    this.element.removeClass('unselected')
                    this.element.addClass('selected')

                    // select the cell in the origional notebook
                    this.events.trigger('select.Cell', {'cell':this.original, 'extendSelection':event.shiftKey});
                }

                // add markdown cell to the Sidebar
                $('#cell-wrapper').append(newCell.element);
                Jupyter.sidebar.cells.push(newCell);

                newCell.render();
                newCell.focus_editor();
            }
        }
    }


    Sidebar.prototype.expand = function(ids = []){
        $('#cell-wrapper').show()
        if(this.collapsed){
            this.collapsed = false;

            var site_height = $("#site").height();
            var site_width = $("#site").width();
            var notebook_width = $("#notebook-container").width();
            var sidebar_width = (site_width - 45) / 2

            $("#notebook-container").animate({
                marginLeft: '15px',
                width: sidebar_width
            }, 400)

            this.element.animate({
                right: '15px',
                width: sidebar_width
            }, 400, function(){if(ids.length > 0){Jupyter.sidebar.typeset(ids)}})

            this.open_button.hide();
            this.close_button.show();
        }
        if(ids.length>0){
            Jupyter.sidebar.typeset(ids)
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
            width: 0
        }, 250);

        this.close_button.hide();
        this.open_button.show();
    };

    function createSidebar() {
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
        // add menu items to edit menu for hiding and showing cells
        var editMenu = $('#edit_menu');

        editMenu.append($('<li>')
            .addClass('divider')
        );

        editMenu.append($('<li>')
            .attr('id', 'hide_cell')
            .append($('<a>')
                .attr('href', '#')
                .text('Indent Cell')
                .click(hideCell)
            )
        );

        editMenu.append($('<li>')
            .attr('id', 'show_cell')
            .append($('<a>')
                .attr('href', '#')
                .text('Unindent Cell')
                .click(unindentCell)
            )
        );
    }

    function renderJanusButtons() {
        // add buttons to toolbar fo hiding and showing cells
        var hideAction = {
            icon: 'fa-indent',
            help    : 'Indent cells',
            help_index : 'zz',
            handler : hideCell
        };

        var showAction = {
            icon: 'fa-outdent',
            help    : 'Unindent cells',
            help_index : 'zz',
            handler : unindentCell
        };

        var prefix = 'janus';
        var hide_action_name = 'hide-cell';
        var show_action_name = 'show-cell';

        var full_hide_action_name = Jupyter.actions.register(hideAction, hide_action_name, prefix);
        var full_show_action_name = Jupyter.actions.register(showAction, show_action_name, prefix);
        Jupyter.toolbar.add_buttons_group([full_hide_action_name, full_show_action_name]);
    }



    function patchCodeExecute(){
        console.log('Patching Code Execute')
        var oldCodeCellExecute = CodeCell.CodeCell.prototype.execute;
        CodeCell.CodeCell.prototype.execute = function(){
            console.log('Running new Execution Code')

            that = this;
            function updateCellOnExecution(evt){
                that.duplicate.fromJSON(that.toJSON())
                events.off('kernel_idle.Kernel', updateCellOnExecution)
            }

            if(this.metadata.cell_hidden){
                console.log(this.duplicate.get_text())
                this.set_text(this.duplicate.get_text())
                oldCodeCellExecute.apply(this, arguments);
                //TODO may need to wait till execute finishes to update
                events.on('kernel_idle.Kernel', updateCellOnExecution);
            }
            else{
                oldCodeCellExecute.apply(this, arguments);
            }

        }

    }

    //TODO implement handling of text cell rendering
    function patchTextExecute(){

    }

    function patchInsertCellAtIndex(){
        console.log('Patching Insert Cell')
        /* Get newly created cells to track unexecuted changes */
        var oldInsertCellAtIndex = Jupyter.notebook.__proto__.insert_cell_at_index;
        Jupyter.notebook.__proto__.insert_cell_at_index = function(){
            c = oldInsertCellAtIndex.apply(this, arguments);
            c.metadata.janus_cell_id = Math.random().toString(16).substring(2);
            return c;
        }
    }

    function hideCellsAtStart(){
        // hide all hidden cells once the notebook is opened
        // console.log('Hiding cells at Start')

        $(".placeholder").remove()

        cells = Jupyter.notebook.get_cells();
        serial_hidden_cells = []

        for(i = 0; i < cells.length; i++){
            // make sure all cells have the right metadata
            if (cells[i].metadata.cell_hidden === undefined){
                cells[i].metadata.cell_hidden = false;
            }
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
                    // hide the cells and get a list of their ids
                    cell_ids = []
                    for(j = 0; j < serial_hidden_cells.length; j++){
                        serial_hidden_cells[j].element.addClass('hidden');
                        cell_ids.push(serial_hidden_cells[j].metadata.janus_cell_id);
                    }
                    // create placeholder that will render this group of hidden cells
                    serial_hidden_cells[serial_hidden_cells.length - 1].element.after($('<div>')
                        .addClass('placeholder')
                        .data('ids', cell_ids.slice())
                        .click(function(){
                            showCell($(this).data('ids'))
                        })
                        .text(`${cell_ids.length}`))

                    serial_hidden_cells = []
                }
            }
        }
    }

    function hideCell(){
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
        console.log(end_element)
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


        // put placehoder div immediatley after it
        hidden_cells[hidden_cells.length - 1].element.after($('<div>')
            .addClass('placeholder')
            .data('ids', cell_ids.slice())
            .click(function(){
                showCell($(this).data('ids'))
            })
            .text(`${cell_ids.length}`))
    }

    function showCell(ids){
        console.log(ids)
        // get the cells we should show
        cells = Jupyter.notebook.get_cells()
        cells_to_copy = []
        for(i=0; i<cells.length; i++){
            if ( $.inArray( cells[i].metadata.janus_cell_id, ids ) > -1 ){
                cells_to_copy.push(cells[i])
            }
        }

        Jupyter.sidebar.expand(cells_to_copy)
    }

    function unindentCell(){
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

        hideCellsAtStart()
    }

    function expandAndTypeset(cells_to_copy, callback){
        Jupyter.sidebar.expand();
        callback();

    }

    function load_extension(){
        /* Called as extension loads and notebook opens */
        console.log('[Janus] is working');
        load_css()
        renderJanusMenu()
        renderJanusButtons()
        createSidebar()
        patchCodeExecute()
        patchInsertCellAtIndex();
        hideCellsAtStart()
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
