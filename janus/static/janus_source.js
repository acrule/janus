/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes
*/

define([
    'jquery',
    'base/js/namespace'
], function(
    $,
    Jupyter
){

    function toggleSourceVisibility() {
        /* Hide/Show the source of individual cells */

        var cell = Jupyter.notebook.get_selected_cell();
        cell.element.find("div.input").toggle('slow');
        cell.metadata.janus.source_hidden =! cell.metadata.janus.source_hidden;
        renderSourceMarker(cell);
    }

    function renderSourceMarker(cell) {
        /* Show marker on cell with hidden source */

        if (cell.metadata.janus.source_hidden) {
            removeHiddenSourceMarkers(cell);
            addHiddenSourceMarker(cell);
        }
        else if (cell.cell_type == 'code'){
            removeHiddenSourceMarkers(cell);
            Jupyter.sidebar.collapse();
        }
    }

    function removeHiddenSourceMarkers(cell) {
        /* remove all hidden source markers from a cell */

        var output_area = cell.element.find('div.output_wrapper')[0];
        if (output_area) {
            var markers = output_area.getElementsByClassName('hidden-code')
            while (markers[0]) {
                markers[0].parentNode.removeChild(markers[0]);
            }
        }
    }

    function addHiddenSourceMarker(cell) {
        /* add a hidden source marker to a cell */

        var output_area = cell.element.find('div.output_wrapper')[0];
        if (output_area) {
            var newElement = document.createElement('div');
            newElement.className = "marker hidden-code fa fa-code";
            newElement.onclick = function() {
                showSourceInSidebar(cell, newElement);
            };
            output_area.appendChild(newElement);
            if (! cell.selected) {
                $(newElement).hide()
            }
        }
    }

    function showSourceInSidebar(cell, marker) {
        /* Show this cell's source in the sidebar */

        Jupyter.sidebar.marker = marker
        Jupyter.sidebar.markerPosition = $(cell.element).position().top
        Jupyter.sidebar.toggle([cell])
    }

    function initializeSourceVisibility() {
        /* hide any sources of cells with source hidden metadata */

        var cells = Jupyter.notebook.get_cells()
        for ( i=0; i < cells.length; i++ ) {
            if (cells[i].metadata.janus.source_hidden) {
                renderSourceMarker(cells[i]);
                cell.element.find("div.input").hide();
            }
        }
    };

    return {
        toggleSourceVisibility: toggleSourceVisibility,
        initializeSourceVisibility: initializeSourceVisibility
    };
});
