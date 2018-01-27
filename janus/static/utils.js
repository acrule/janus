/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes

Handle indenting and unindenting of cells to and from the Janus sidebar
*/

define([
    'jquery',
    'base/js/namespace',
    'notebook/js/cell',
    'notebook/js/codecell',
    'notebook/js/textcell',
], function(
    $,
    Jupyter,
    Cell,
    CodeCell,
    TextCell,
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


    function getDuplicateCell(cellJSON, nb) {
        /* return a copy of a cell

        Args:
            cellJSON: JSON of cell to duplicate
        */

        newCell = null;

        // markdown cells
        if(cellJSON.cell_type == 'markdown'){
            newCell = new TextCell.MarkdownCell({
                events: nb.events,
                config: nb.config,
                keyboard_manager: nb.keyboard_manager,
                notebook: nb,
                tooltip: nb.tooltip,
            });
        }
        // code cells
        else if(cellJSON.cell_type == 'code'){
            newCell = new CodeCell.CodeCell(nb.kernel, {
                events: nb.events,
                config: nb.config,
                keyboard_manager: nb.keyboard_manager,
                notebook: nb,
                tooltip: nb.tooltip,
            });
        }
        else if (cellJSON.cell_type = 'raw'){
            newCell = new TextCell.RawCell({
                events: nb.events,
                config: nb.config,
                keyboard_manager: nb.keyboard_manager,
                notebook: nb,
                tooltip: nb.tooltip,
            });
        }

        // populate sidebar cell with content of notebook cell
        // cell_data = cell.toJSON();
        newCell.fromJSON(cellJSON);

        return newCell

    }

    return {
        getTimeAndSelection: getTimeAndSelection,
        removeMarkerType: removeMarkerType,
        addMarkerToElement: addMarkerToElement,
        getMarkerContainer: getMarkerContainer,
        getDuplicateCell: getDuplicateCell
    }


})
