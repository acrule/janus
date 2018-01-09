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

// Input functions
    function renderSourceMarker(cell){
        /* Show marker on cell with hidden source */
        if(cell.metadata.janus.source_hidden){

            // clear any current code hidden markers
            var output_area = cell.element.find('div.output_wrapper')[0]
            var markers = output_area.getElementsByClassName('hidden-code')
            while(markers[0]){
                markers[0].parentNode.removeChild(markers[0]);
            }

            // add the new marker
            var newElement = document.createElement('div');
            newElement.className = "marker hidden-code fa fa-code"
            newElement.onclick = function(){showSourceInSidebar(cell, newElement)};
            output_area.appendChild(newElement)
        }
        else if (cell.cell_type == 'code'){
            // clear any current code hidden markers
            var output_area = cell.element.find('div.output_wrapper')[0]
            if(output_area){
                var markers = output_area.getElementsByClassName('hidden-code')
                while(markers[0]){
                    markers[0].parentNode.removeChild(markers[0]);
                }
            }
            Jupyter.sidebar.collapse();
        }
    }

    function renderAllSourceMarkers(){
        /* Show marker on all cells with hidden source */
        all_cells = Jupyter.notebook.get_cells()
        for(i=0; i < all_cells.length; i++){
            renderSourceMarker(all_cells[i]);

            // only show marker when cell is selected
            if(!all_cells[i].selected){
                CellHistory.hide_markers(all_cells[i]);
            }
        }
    }

    function toggleSource(){
        /* Hide/Show the source of individual cells */
        var cell = Jupyter.notebook.get_selected_cell();
        cell.element.find("div.input").toggle('slow');
        cell.metadata.janus.source_hidden =! cell.metadata.janus.source_hidden;
        renderSourceMarker(cell);
    }

    function showSourceInSidebar(cell, marker){
        /* Show this cell's source in the sidebar */
        Jupyter.sidebar.marker = marker
        Jupyter.sidebar.markerPosition = $(cell.element).position().top
        Jupyter.sidebar.toggle([cell])
    }

    function updateSourceVisibility(){
        /* hide any sources of cells with source hidden metadata */
        Jupyter.notebook.get_cells().forEach(function(cell) {
            if (cell.metadata.janus.source_hidden) {
                cell.element.find("div.input").hide();
            }
        })
    };


    return {
        renderAllSourceMarkers: renderAllSourceMarkers,
        toggleSource: toggleSource,
        updateSourceVisibility: updateSourceVisibility
    };
});
