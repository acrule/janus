/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
hiding cells and tracking changes
*/

define([
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/events',
    '../janus/patch',
    '../janus/sidebar',
    '../janus/versions',
    '../janus/hide',
    '../janus/history',
    '../janus/ui'
], function(
    require,
    $,
    Jupyter,
    events,
    JanusPatch,
    JanusSidebar,
    JanusVersions,
    JanusHide,
    JanusHistory,
    JanusUI
){

    function loadCSS() {
        /* Load Janus css */

        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = require.toUrl("./main.css");
        document.getElementsByTagName("head")[0].appendChild(link);
    };


    function loadJanusPostNotebook() {
        /* run steps that require cells to already be loaded */

        JanusPatch.initializeJanusMetadata();        
        JanusVersions.initializeVersionMarkers();
        JanusHide.initializeVisibility();
        Jupyter.sidebar.updateHiddenCells();
        JanusHistory.prepHistoryTracking();
    }


    function loadExtension(){
        /* Called as extension loads and notebook opens */

        loadCSS();
        JanusUI.renderJanusUI();
        JanusSidebar.createSidebar();
        JanusPatch.applyJanusPatches();

        // make sure notebook is fully loaded before interacting with it
        if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
            loadJanusPostNotebook();
        }
        events.on("notebook_loaded.Notebook", loadJanusPostNotebook);
    }


    return {
        /* Tell Jupyter what to run when the extension loads */
        load_jupyter_extension: loadExtension,
        load_ipython_extension: loadExtension
    };

});
