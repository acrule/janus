/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
hiding cells and tracking changes
*/

define([
    'jquery',
    'base/js/namespace',
    'base/js/utils',
    'notebook/js/cell',
    'notebook/js/codecell',
    'notebook/js/textcell',
], function(
    $,
    Jupyter,
    utils,
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
        newCell.fromJSON(cellJSON);

        return newCell

    }


// MINIMAP
    function showMinimap(event, el) {
        /* render rich tooltip with miniturized view of hidden cells

        Args:
            event: mouseout event that triggers hidding minimap
            el: placeholder element triggering event
        */

        // change placeholder background color onhover
        el.style.backgroundColor = "#f5f5f5"

        var el_top = $(el).parent().position().top;
        var el_right = $(el).parent().position().left + $(el).parent().width();
        var cell_ids = $(el).data('ids');
        var sectionIndex = $(el).data('sectionIndex');
        var showing = Jupyter.sidebar.sections[sectionIndex].showing

        // if this collection of cells is already in sidebar, don't show minimap
        if (showing) {
            return
        }

        // get cells ready to copy to minimap
        var cells = Jupyter.notebook.get_cells()
        var cells_to_copy = []
        for(i=0; i<cells.length; i++){
            if ( $.inArray( cells[i].metadata.janus.id, cell_ids ) > -1 ){
                cells_to_copy.push(cells[i])
            }
        }

        // create minimap
        var minimap = $('<div id=minimap>');

        moveMinimap(event, el);

        $("#notebook").append(minimap);
        var mini_wrap = $('<div>').addClass('mini-wrap')
        minimap.append(mini_wrap)


        // populate it with our cells
        // for each cell, create a new cell in the Sidebar with the same content
        for (i = 0; i < cells_to_copy.length; i++){

            // add new cell to the sidebar
            var cell = cells_to_copy[i]
            var nb = Jupyter.notebook

            // append cells to minimap
            cellData = cell.toJSON();
            newCell = getDuplicateCell(cellData, nb)
            newCell.code_mirror.setOption('readOnly', "nocursor");
            $('.mini-wrap').append(newCell.element);

            // make sure all code cells are rendered
            // TODO find another way to do this without it focusing the cell
            if (newCell.cell_type == 'code') {
                newCell.render();
                newCell.refresh();
            }

            // hide output if needed
            if(newCell.metadata.janus.source_hidden && ! newCell.metadata.janus.output_hidden){
                newCell.element.find("div.output_wrapper").hide();
            }
            if(newCell.metadata.janus.output_hidden && ! newCell.metadata.janus.source_hidden){
                newCell.element.find("div.input").hide();
            }
        }

        // reset div height to account for scaling
        var cells_height = $(mini_wrap).height()
        minimap.height(cells_height * 0.5)
    }


    function hideMinimap(event, el) {
        /* remove any mini-map divs

        Args:
            event: mouseout event that triggers hidding minimap
            el: placeholder element triggering event
        */

        $('#minimap').remove()
        el.style.backgroundColor = ""
    }


    function moveMinimap(event, el) {
        var mouseTop = event.clientY
        var mouseRight = event.clientX
        var topOffset = $('#site').position().top
        var topScroll = $('#site').scrollTop()
        var siteWidth = $('#site').width()
        var siteHeight = $('#site').height()
        var nbHeight = $('#notebook-container').height()
        var miniWidth = $('#minimap').width()

        // ensure tooltip does not go off the page
        if ((mouseRight + miniWidth) > siteWidth - 24 ) {
            mouseRight = siteWidth - miniWidth - 24;
        }

        // there is 100px buffer at the end, so we add 80px to leave 20px buffer
        var maxHeight = siteHeight - (mouseTop - topOffset) - 8;

        var minimap = $('#minimap');
        minimap.css({
            'max-height': maxHeight,
            'top': mouseTop - topOffset + topScroll + 12,
            'left': mouseRight + 12
        })
    }


    // LOG ACTIONS
    function logJanusAction(nb, t, name, selID, selIDs) {
        /* Send information about action to server to process and save

        Args:
            nb: the notebook
            t: time of action
            actionName: name of action to be tracked
            selID: cell_id of selected of clicked cell
            selIDs: cell_ids for all cells being shown, hidden, and so on
        */

        // get url to send POST request
        var baseUrl = nb.base_url;
        var nbUrl =  nb.notebook_path;
        var url = utils.url_path_join(baseUrl, 'api/janus', nbUrl);

        // get data ready
        var d = JSON.stringify({
            time: t,
            name: name,
            id: selID,
            ids: selIDs,
            type: 'log'
        });

        // prepare POST settings
        var settings = {
            processData : false,
            type : 'POST',
            dataType: 'json',
            data: d,
            contentType: 'application/json',
        };

        // send the POST request,
        utils.promising_ajax(url, settings);
    }


    return {
        getTimeAndSelection: getTimeAndSelection,
        removeMarkerType: removeMarkerType,
        addMarkerToElement: addMarkerToElement,
        getMarkerContainer: getMarkerContainer,
        getDuplicateCell: getDuplicateCell,
        showMinimap: showMinimap,
        hideMinimap: hideMinimap,
        moveMinimap: moveMinimap,
        logJanusAction: logJanusAction
    }


})
