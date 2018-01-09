/*
Janus: Jupyter Notebook Extension that assists with notebook cleaning
*/

define([
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/events',
    '../janus/janus_patch',
    '../janus/janus_sidebar',
    '../janus/janus_history',
    '../janus/janus_source',
    '../janus/janus_indent'
], function(
    require,
    $,
    Jupyter,
    events,
    JanusPatch,
    JanusSidebar,
    JanusHistory,
    JanusSource,
    JanusIndent
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
                .click(JanusIndent.indentCell)
            )
        );

        // unindent cell
        editMenu.append($('<li>')
            .attr('id', 'unindent_cell')
            .append($('<a>')
                .attr('href', '#')
                .text('Unindent Cell')
                .click(JanusIndent.unindentCell)
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
            handler : JanusIndent.indentCell
        };

        var unindentAction = {
            icon: 'fa-outdent',
            help    : 'Unindent cells',
            help_index : 'zz',
            handler : JanusIndent.unindentCell
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
            JanusHistory.load_cell_history();
            JanusSource.updateSourceVisibility();
            JanusSource.renderAllSourceMarkers();
        }

        // or wait until the notebook has loaded to perform them
        events.on("notebook_loaded.Notebook", initializeJanusMetadata);
        events.on("notebook_loaded.Notebook", Jupyter.sidebar.hideIndentedCells);
        events.on("notebook_loaded.Notebook", JanusHistory.load_cell_history);
        events.on("notebook_loaded.Notebook", JanusSource.updateSourceVisibility);
        events.on("notebook_loaded.Notebook", JanusSource.renderAllSourceMarkers);
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
