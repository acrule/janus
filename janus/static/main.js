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
    '../janus/cell_history',
    '../janus/janus_source'
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
    JanusSidebar,
    CellHistory,
    JanusSource
){

    //TODO add a clutch for the cell history tracking (off by default)
    //TODO move Jupyter.sidebar to Jupyter.notebook.sidebar
    //TODO show full history of all cell executions
    //TODO enable incrimental loading of previous results (incpy)
    //TODO enable meta-data only notebook history tracking (stretch)
    //TODO render more informative marker of hidden cells (stretch)

    function load_css() {
        /* Load css for sidebar */
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = require.toUrl("./main.css");
        document.getElementsByTagName("head")[0].appendChild(link);
    };

    function renderJanusMenu(){
        /* add Janus menu items to 'Edit' menu */
        var editMenu = $('#edit_menu');

        editMenu.append($('<li>')
            .addClass('divider')
        );

        // indent cell
        editMenu.append($('<li>')
            .attr('id', 'indent_cell')
            .append($('<a>')
                .attr('href', '#')
                .text('Indent Cell')
                .click(indentCell)
            )
        );

        // unindent cell
        editMenu.append($('<li>')
            .attr('id', 'unindent_cell')
            .append($('<a>')
                .attr('href', '#')
                .text('Unindent Cell')
                .click(unindentCell)
            )
        );

        // Toggle Input
        editMenu.append($('<li>')
            .attr('id', 'toggle_cell_input')
            .append($('<a>')
                .attr('href', '#')
                .text('Toggle Cell Input')
                .click(JanusSource.toggleSource)
            )
        );

        //TODO add toggle cellhistory
    }

    function renderJanusButtons() {
        /* add Janus buttons to toolbar for easy access */
        var toggleSourceAction = {
            icon: 'fa-code',
            help    : 'Toggle Input',
            help_index : 'zz',
            handler : JanusSource.toggleSource
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
        var full_toggle_action_name = Jupyter.actions.register(toggleSourceAction,
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

    function initializeJanusMetadata(){
        /* ensure all notebook cells have Janus metadata */
        cells = Jupyter.notebook.get_cells();
        for(i=0; i<cells.length; i++){
            JanusPatch.generateDefaultJanusMetadata(cells[i]);
        }
    }



    function indentCell(){
        /* move selected cells to the sidebar */
        cells = Jupyter.notebook.get_selected_cells();

        // find where the selected cells are in the notebook
        all_cells = Jupyter.notebook.get_cells();
        sel_start_id = all_cells.indexOf(cells[0]);
        sel_end_id = all_cells.indexOf(cells[cells.length - 1]);
        start_id = all_cells.indexOf(cells[0]);
        end_id = all_cells.indexOf(cells[cells.length - 1]);

        // check if the immediately prior cell(s) is/are already hidden
        while(start_id > 0){
            if(all_cells[start_id - 1].metadata.janus.cell_hidden == true){
                start_id = start_id -1;
            }
            else{
                break;
            }
        }

        // check if the immediately following cell(s) is/are already hidden
        while(end_id < all_cells.length - 1){
            if(all_cells[end_id + 1].metadata.janus.cell_hidden == true){
                end_id = end_id + 1;
            }
            else{
                break;
            }
        }

        // get rid of the existing placeholders
        start_element = all_cells[start_id].element;
        end_element = $(all_cells[end_id].element).next();
        contained_placeholders = $(start_element).nextUntil(end_element)
                                    .add(end_element)
                                    .filter('div.placeholder');
        $(contained_placeholders).remove();

        // get the whole expanded selection of hidden cells_to_copy
        hidden_cells = all_cells.slice(start_id, end_id+1);
        cell_ids = [];

        // set the metadata and hide cells
        for(i=0; i < hidden_cells.length; i++){
            hidden_cells[i].metadata.janus.cell_hidden = true;
            hidden_cells[i].element.addClass('hidden');
            cell_ids.push(hidden_cells[i].metadata.janus.cell_id);
        }

        // put placeholder div immediatley after last hidden cell
        Jupyter.sidebar.addPlaceholderAfterElementWithIds(
            hidden_cells[hidden_cells.length - 1].element,
            cell_ids)
        Jupyter.sidebar.update();
    }

    function unindentCell(){
        /* move selected cells back to main notebook */
        cells = Jupyter.notebook.get_selected_cells();

        // make hidden cells visible
        for(i=0; i<cells.length; i++){
            cells[i].element.removeClass('hidden');
            cells[i].metadata.janus.cell_hidden = false;
            cells[i].set_text(cells[i].sb_cell.get_text());
            cells[i].render();
        }

        // remove any hidden cells from the sidebar
        for(j=0; j<Jupyter.sidebar.cells.length; j++){
            if(Jupyter.sidebar.cells[j].selected){
                Jupyter.sidebar.cells[j].element.addClass('hidden');
                Jupyter.sidebar.cells[j].element.remove();
                Jupyter.sidebar.cells.splice(i, 1);
            }
        }

        // update sidebar and notebook rendering of hidden cells
        Jupyter.sidebar.hideIndentedCells();
        Jupyter.sidebar.update();
    }

    function load_extension(){
        /* Called as extension loads and notebook opens */
        load_css();
        renderJanusMenu();
        renderJanusButtons();
        JanusSidebar.createSidebar();
        JanusPatch.applyJanusPatches();

        // run steps that require cells to already be loaded
        if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
            initializeJanusMetadata();
            Jupyter.sidebar.hideIndentedCells();
            CellHistory.load_cell_history();
            JanusSource.updateSourceVisibility();
            JanusSource.renderAllSourceMarkers();
        }

        // or wait until the notebook has loaded to perform them
        events.on("notebook_loaded.Notebook", initializeJanusMetadata);
        events.on("notebook_loaded.Notebook", Jupyter.sidebar.hideIndentedCells);
        events.on("notebook_loaded.Notebook", CellHistory.load_cell_history);
        events.on("notebook_loaded.Notebook", JanusSource.updateSourceVisibility);
        events.on("notebook_loaded.Notebook", JanusSource.renderAllSourceMarkers);

    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
