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
    '../janus/janus_indent',
    '../janus/janus_nb_history'
], function(
    require,
    $,
    Jupyter,
    events,
    JanusPatch,
    JanusSidebar,
    JanusHistory,
    JanusSource,
    JanusIndent,
    JanusHist
){

    //TODO show full history of all cell executions (Sean?)
    //TODO enable truncated history based on program analysis... (Sean?)
    //TODO enable meta-data only notebook history tracking (stretch)

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
        // var editMenu = $('#edit_menu');
        var navbar = $('#menubar .nav').first()

        navbar.append($('<li>')
            .addClass('dropdown')
            .attr('id', 'janus-header')
            .append($('<a>')
                .addClass('dropdown-toggle')
                .attr('href','#')
                .attr('data-toggle', 'dropdown')
                .text('Janus')
                )
            );

        var janusHeader = $('#janus-header')
        janusHeader.append($('<ul>')
            .addClass('dropdown-menu')
            .attr('id', 'janus-menu')
        );

        var janusMenu = $('#janus-menu');

        // indent cell
        janusMenu.append($('<li>')
            .attr('id', 'indent_cell')
            .append($('<a>')
                .attr('href', '#')
                .text('Indent Cell')
                .click(JanusIndent.indentCell)
            )
        );

        // unindent cell
        janusMenu.append($('<li>')
            .attr('id', 'unindent_cell')
            .append($('<a>')
                .attr('href', '#')
                .text('Unindent Cell')
                .click(JanusIndent.unindentCell)
            )
        );

        // Toggle Input
        janusMenu.append($('<li>')
            .attr('id', 'toggle_cell_input')
            .append($('<a>')
                .attr('href', '#')
                .text('Toggle Cell Input')
                .click(JanusSource.toggleSource)
            )
        );

        janusMenu.append($('<li>')
            .addClass('divider')
        );

        janusMenu.append($('<li>')
            .attr('id', 'toggle_nb_history')
            .append($('<a>')
                .attr('href', '#')
                .text('Toggle Notebook History')
                //.click(JanusHistory.toggleCellHistoryTracking)
            )
        );

        janusMenu.append($('<li>')
            .attr('id', 'toggle_cell_history')
            .append($('<a>')
                .attr('href', '#')
                .text('Toggle Cell History')
                .click(JanusHistory.toggleCellHistoryTracking)
            )
        );
    }

    function renderJanusButtons() {
        /* add Janus buttons to toolbar for easy access */
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

        var toggleSourceAction = {
            icon: 'fa-code',
            help    : 'Toggle Input',
            help_index : 'zz',
            handler : JanusSource.toggleSource
        };

        var showNbHistAction = {
            icon: 'fa-history',
            help    : 'Show Notebook History',
            help_index : 'zz',
            handler : function(){console.log("Show Notebook History")}
        };

        var toggleHistoryAction = {
            icon: 'fa-code-fork',
            help    : 'Show Cell Versions',
            help_index : 'zz',
            handler : JanusHistory.toggleCellHistoryTracking
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
        var full_show_nb_hist_action_name = Jupyter.actions.register(showNbHistAction,
                                                            'toggle-nb-history',
                                                            prefix);
        var full_toggle_hist_action_name = Jupyter.actions.register(toggleHistoryAction,
                                                            'toggle-cell-history',
                                                            prefix);

        Jupyter.toolbar.add_buttons_group([full_indent_action_name,
                                        full_unindent_action_name,
                                        full_toggle_action_name]);

        Jupyter.toolbar.add_buttons_group([full_show_nb_hist_action_name,
                                        full_toggle_hist_action_name]);
    }

    function initializeJanusMetadata(){
        /* ensure all notebook cells have Janus metadata */

        // flag whether we want to track a full history of the notebook
        // for now we won't use this metadata, but just track all the time
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
            JanusHist.prepNbHistoryTracking();
        }

        // or wait until the notebook has loaded to perform them
        events.on("notebook_loaded.Notebook", initializeJanusMetadata);
        events.on("notebook_loaded.Notebook", Jupyter.sidebar.hideIndentedCells);
        events.on("notebook_loaded.Notebook", JanusHistory.load_cell_history);
        events.on("notebook_loaded.Notebook", JanusSource.updateSourceVisibility);
        events.on("notebook_loaded.Notebook", JanusSource.renderAllSourceMarkers);
        events.on("notebook_loaded.Notebook", JanusHist.prepNbHistoryTracking);
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
