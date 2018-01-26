/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes

Handle indenting and unindenting of cells to and from the Janus sidebar
*/

define([
    'jquery',
    'base/js/namespace'
], function(
    $,
    Jupyter
){

    function getTimeAndSelection() {
        /* get time and selected cells */

        var t = Date.now();
        var selIndex = Jupyter.notebook.get_selected_index();
        var selIndices = Jupyter.notebook.get_selected_cells_indices();

        return {
            t: t,
            selIndex: selIndex,
            selIndices: selIndices
        }
    }


    function removeMarkerType(markerClass, element) {
        /* remove all markers of a particular type for a certain cell

        Args:
            markerClass: class of element to remove
            element: element to remove markers from
        */

        var markers = $(element).find(markerClass);
        console.log(markers)
        for (var i = 0; i < markers.length; i++) {
            $(markers[i]).remove()
        }
    }


    function addMarkerToElement(element, classes) {
        /* add a marker to a particular element of the cells

        Args:
            element: specific element to append marker to
            classes: classes to assign to marker
        */
        if (element) {
            var newElement = document.createElement('div');
            newElement.className = classes
            element.appendChild(newElement);
        }
        return newElement
    }


    function getMarkerContainer(cell) {
        /* create container in cell's input area to hold markers

        Args:
            cell: cell to create marker container for

        */

        var inputArea = cell.element.find('div.input_area')[0]
        var markerContainer = cell.element.find('div.marker-container')[0];

        if (markerContainer) {
            return markerContainer
        } else {
            var markerContainer = document.createElement('div')
            inputArea.style.position = "relative";
            markerContainer.className = "marker-container"
            inputArea.appendChild(markerContainer);
            return markerContainer
        }
    }


    return {
        getTimeAndSelection: getTimeAndSelection,
        removeMarkerType: removeMarkerType,
        addMarkerToElement: addMarkerToElement,
        getMarkerContainer: getMarkerContainer
    }


})
