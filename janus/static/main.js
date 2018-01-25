/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes
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
    '../janus/janus_nb_history',
    '../janus/janus_menu'
], function(
    require,
    $,
    Jupyter,
    events,
    JanusPatch,
    JanusSidebar,
    JanusHistory,
    JanusSource,
    JanusNBHist,
    JanusMenu
){

    function load_css() {
        /* Load css for sidebar */

        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = require.toUrl("./main.css");
        document.getElementsByTagName("head")[0].appendChild(link);
    };

    function load_extension(){
        /* Called as extension loads and notebook opens */

        load_css();
        JanusMenu.renderJanusUI();
        JanusSidebar.createSidebar();
        JanusPatch.applyJanusPatches();

        // run steps that require cells to already be loaded
        if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
            JanusPatch.initializeJanusMetadata();
            Jupyter.sidebar.hideIndentedCells();
            JanusHistory.load_cell_history();
            JanusSource.initializeSourceVisibility();
            JanusNBHist.prepNbHistoryTracking();
        }

        // or wait until the notebook has loaded to perform them
        events.on("notebook_loaded.Notebook", JanusPatch.initializeJanusMetadata);
        events.on("notebook_loaded.Notebook", Jupyter.sidebar.hideIndentedCells);
        events.on("notebook_loaded.Notebook", JanusHistory.load_cell_history);
        events.on("notebook_loaded.Notebook", JanusSource.initializeSourceVisibility);
        events.on("notebook_loaded.Notebook", JanusNBHist.prepNbHistoryTracking);
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
