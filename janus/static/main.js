/*
Janus: Jupyter Notebook Extension that assists with notebook cleaning
*/

define([
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/events',
    'base/js/utils',
    'notebook/js/cell',
    'notebook/js/codecell',
    'notebook/js/textcell',
    '../janus/patch',
    '../janus/sidebar',
    '../janus/cell_history'
], function(
    require,
    $,
    Jupyter,
    events,
    utils,
    Cell,
    CodeCell,
    TextCell,
    JanusPatch,
    Sidebar,
    CellHistory
){

    //TODO refactor
    //TODO enable cell-level histories
    //TODO show full history of all cell executions
    //TODO enable meta-data only notebook history tracking (stretch)
    //TODO render more informative marker of hidden cells (stretch)

    function createSidebar() {
        /* create a new sidebar element */

        return new Sidebar.Sidebar(Jupyter.notebook);
    }

    function load_css() {
        /* Load css for sidebar */
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

        editMenu.append($('<li>')
            .attr('id', 'toggle_cell_input')
            .append($('<a>')
                .attr('href', '#')
                .text('Toggle Cell Input')
                .click(toggleInput)
            )
        );
    }

    function renderJanusButtons() {
        /* add buttons to toolbar fo hiding and showing cells*/

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

        var full_toggle_action_name = Jupyter.actions.register(toggleInputAction,
                                                            'toggle-cell-input',
                                                            prefix);
        var full_indent_action_name = Jupyter.actions.register(indentAction,
                                                            'indent-cell',
                                                            prefix);
        var full_unindent_action_name = Jupyter.actions.register(unindentAction,
                                                            'unindent-cell',
                                                            prefix);

        Jupyter.toolbar.add_buttons_group([full_indent_action_name,
                                        full_unindent_action_name,
                                        full_toggle_action_name]);
    }

    function renderCodeMarker(cell){
        if(cell.metadata.hide_input){
            // clear any current code hidden markers
            var output_area = cell.element.find('div.output_wrapper')[0]
            var markers = output_area.getElementsByClassName('hidden-code-marker')
            while(markers[0]){
                markers[0].parentNode.removeChild(markers[0]);
            }

            // add the new marker
            var newElement = document.createElement('div');
            newElement.className = "hidden-code-marker fa fa-code"
            newElement.onclick = function(){showCodeInSidebar(cell, newElement)};
            output_area.appendChild(newElement)
        }
        else if (cell.cell_type == 'code'){
            // clear any current code hidden markers
            var output_area = cell.element.find('div.output_wrapper')[0]
            if(output_area){
                var markers = output_area.getElementsByClassName('hidden-code-marker')
                while(markers[0]){
                    markers[0].parentNode.removeChild(markers[0]);
                }
            }
            Jupyter.sidebar.collapse();
        }
    }

    function renderAllCodeMarkers(){
        all_cells = Jupyter.notebook.get_cells()
        for(i=0; i < all_cells.length; i++){
            renderCodeMarker(all_cells[i]);
        }
    }

    function toggleInput(){
        var cell = Jupyter.notebook.get_selected_cell();
        // Toggle visibility of the input div
        cell.element.find("div.input").toggle('slow');
        cell.metadata.hide_input =! cell.metadata.hide_input;
        renderCodeMarker(cell);
    }

    function showCodeInSidebar(cell, marker){
        Jupyter.sidebar.marker = marker
        Jupyter.sidebar.markerPosition = $(cell.element).position().top
        Jupyter.sidebar.toggle([cell])
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
        Jupyter.sidebar.addPlaceholderAfterElementWithIds(hidden_cells[hidden_cells.length - 1].element, cell_ids)
        Jupyter.sidebar.update()
    }

    function unindentCell(){
        // move selected cells back to main notebook

        cells = Jupyter.notebook.get_selected_cells();

        // make hidden cells visible
        for(i=0; i<cells.length; i++){
            cells[i].element.removeClass('hidden')
            cells[i].metadata.cell_hidden = false
            cells[i].set_text(cells[i].sb_cell.get_text())
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
        Jupyter.sidebar.hideIndentedCells()
        Jupyter.sidebar.update()
    }

    function load_extension(){
        /* Called as extension loads and notebook opens */
        console.log('[Janus] is working');
        load_css();
        renderJanusMenu();
        renderJanusButtons();
        createSidebar();
        JanusPatch.applyJanusPatches();

        if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
            // notebook already loaded. Update directly
            Jupyter.sidebar.hideIndentedCells();
            CellHistory.load_cell_history();
            updateInputVisibility();
            renderAllCodeMarkers();
        }

        events.on("notebook_loaded.Notebook", Jupyter.sidebar.hideIndentedCells);
        events.on("notebook_loaded.Notebook", CellHistory.load_cell_history);
        events.on("notebook_loaded.Notebook", updateInputVisibility);
        events.on("notebook_loaded.Notebook", renderAllCodeMarkers);
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
