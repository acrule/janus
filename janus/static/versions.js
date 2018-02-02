/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
hiding cells and tracking changes
*/

define([
    'require',
    'jquery',
    'base/js/events',
    'base/js/utils',
    'base/js/namespace',
    'notebook/js/codecell',
    '../janus/utils'
],function(
    require,
    $,
    events,
    utils,
    Jupyter,
    codecell,
    JanusUtils
){

    // reference for later use
    var CodeCell = codecell.CodeCell;

// MARKER CLICK EVENTS
    function createExtraClick(cell) {
        /* Attach function to version marker click events

        Args:
            cell: cell we are working with
            v: index of cell version to show when marker is clicked
        */

        return function() {
            var janus_meta = cell.metadata.janus
            toggleShowAllVersions(cell);

            // change version in any associated sidebar cell as well
            if( (janus_meta.cell_hidden || janus_meta.source_hidden || janus_meta.output_hidden)
                    && ! Jupyter.sidebar.collapsed && cell.nb_cell) {
                toggleShowAllVersions(cell.nb_cell)
            }
        }
    }


    function toggleShowAllVersions(cell){
        /* create a summary marker for cell history versions

        Args:
            cell: cell to show all versions on
        */

        var inputArea = cell.element.find('div.input_area')[0]
        var markerContainer = JanusUtils.getMarkerContainer(cell);
        var extra_markers = $(markerContainer).find(".extra")

        cell.metadata.janus.all_versions_showing = ! cell.metadata.janus.all_versions_showing
        updateMarkerVisibility(cell);
    }


    function createVersionClick(cell, v) {
        /* Attach function to extra marker click events

        Args:
            cell: cell we are working with
        */

        return function() {
            var janus_meta = cell.metadata.janus
            changeVersion(cell, v);

            // change version in any associated sidebar cell as well
            if( (janus_meta.cell_hidden || janus_meta.source_hidden || janus_meta.output_hidden)
                    && ! Jupyter.sidebar.collapsed && cell.nb_cell) {
                changeVersion(cell.nb_cell, janus_meta.current_version)
            }
        }
    }


    function changeVersion(cell, v) {
        /* Change which cell version is shown

        Args:
            cell: cell we are changing the version on
            v: index in cell version list of new cell
        */

        var input_area = cell.element.find('div.input_area')[0];
        var markers = input_area.getElementsByClassName('version')
        var versions = cell.metadata.janus.versions

        // update cell metadata
        cell.metadata.janus.current_version = v;

        // update cell input and output to version
        cell.set_text(versions[v]['content']['source']);
        cell.output_area.clear_output()
        for (var i = 0; i < versions[v]['content']['outputs'].length; i++){
            cell.output_area.append_output(versions[v]['content']['outputs'][i]);
        }

        // highlight marker for selected version
        for (var i = 0; i < markers.length; i++){
            if (i == v) {
                markers[i].classList.add('selected-version')
            } else {
                markers[i].classList.remove('selected-version')
            }
        }
    }


    function toggleCellVersions() {
        /* hide/show cell versions */

        var selCell = Jupyter.notebook.get_selected_cell();
        selCell.metadata.janus.show_versions = ! selCell.metadata.janus.show_versions;

        /* Set message and update menu-items when tracking turned on / off */
        var message = 'Showing Cell Versions';
        if (selCell.metadata.janus.show_versions) {
           message = 'Hiding Cell Versions';
        }
        Jupyter.notification_area.widget('notebook').set_message(message, 2000)

        renderMarkers(selCell);
        updateMarkerVisibility(selCell);

        if (selCell.sb_cell) {
            selCell.sb_cell.metadata.janus.show_versions = ! selCell.sb_cell.metadata.janus.show_versions;
            renderMarkers(selCell.sb_cell);
            updateMarkerVisibility(selCell.sb_cell);
        }
    }


// RENDERING Functions
    //TODO limit cell history search based on paths
    function renderMarkers(cell) {
        /* show version and summary markers

        Args:
            cell: cell to show version markers for
        */

        // only show markers if the correct metadata flag is set
        if (cell.metadata.janus.show_versions) {
            renderSummaryMarker(cell);
            renderVersionMarkers(cell);
        }
        else {
            cell.metadata.janus.versions = [];
        }
    }


    function renderSummaryMarker(cell) {
        /* create a summary marker for cell history versions

        Args:
            cell: cell to show summary marker on
        */

        var inputArea = cell.element.find('div.input_area')[0]
        var markerContainer = JanusUtils.getMarkerContainer(cell);
        var classes = "marker summary fa fa-history"

        // clear current summary markers, add new one
        JanusUtils.removeMarkerType('.summary', inputArea)
        JanusUtils.addMarkerToElement(markerContainer, classes);
    }


    function renderExtraMarker(cell) {
        /* create a summary marker for cell history versions

        Args:
            cell: cell to show summary marker on
        */

        var inputArea = cell.element.find('div.input_area')[0]
        var markerContainer = JanusUtils.getMarkerContainer(cell);
        var classes = "marker extra fa"

        // clear current summary markers, add new one
        JanusUtils.removeMarkerType('.extra', inputArea)
        var newMarker = JanusUtils.addMarkerToElement(markerContainer, classes);
        newMarker.onclick = createExtraClick(cell);

    }


    function renderVersionMarkers(cell) {
        /* get every version of this cell from the database

        Args:
            cell: cell to get history of versions for
        */

        var baseUrl = Jupyter.notebook.base_url;
        var notebookUrl =  Jupyter.notebook.notebook_path;
        var url = utils.url_path_join(baseUrl, 'api/janus', notebookUrl);

        var paths = Jupyter.notebook.metadata.janus.filepaths;
        var cell_id = cell.metadata.janus.id
        var cellVersions = []

        for (var i = 0; i < paths.length; i++) {

            // prepare POST settings
            var settings = {
                type : 'GET',
                data: {
                    q: 'cell_history',
                    cell_id: cell_id,
                    path: paths[i][0],
                    start: paths[i][1],
                    end: paths[i][2]
                },
            };

            // combine results of all queries together before rendering markers
            if(i == paths.length - 1) {
                utils.promising_ajax(url, settings).then( function(value, i) {
                    d = JSON.parse(value)
                    cellVersions = cellVersions.concat(d['versions']);
                    renderVersions(cell, cellVersions)
                });
            }
            else{
                utils.promising_ajax(url, settings).then( function(value, i) {
                    d = JSON.parse(value)
                    cellVersions = cellVersions.concat(d['versions']);
                });
            }
        }
    }


    // TODO update to use version markers
    function renderVersions(cell, cellVersions) {
        /* render markers for each saved cell version

        Args:
            cell: cell to render versions for
            cellVersions: list of all cell versions retrieved from database
        */

        if (cellVersions.length > 0) {

            var inputArea = cell.element.find('div.input_area')[0];
            var markerContainer = JanusUtils.getMarkerContainer(cell);

            // clear current markers
            JanusUtils.removeMarkerType('.version', inputArea);

            // combine list of queried and already named versions
            var cellVersionIds = cellVersions.map( function(a) {return a.version_id;} );
            var namedVersions = cell.metadata.janus.named_versions;
            var namedVersionsIds = namedVersions.map( function(a) {return a.version_id;} );
            var versionsToShow = []
            var curMatch = null;
            var curIndex = null;

            if( cellVersions.length > 0 ){
                for (var j = 0; j < cellVersions.length; j++) {
                    if (namedVersionsIds.indexOf(cellVersions[j].version_id ) == -1) {
                        if (versionHasContent(cellVersions[j])) {
                            versionsToShow.push(cellVersions[j])
                        }
                        if (versionMatchCur(cellVersions[j], cell)){
                            curMatch = cellVersions[j]
                            curIndex = versionsToShow.length - 1
                        }
                    }
                }
            }

            if (namedVersions.length > 0) {
                for (var i = 0; i < namedVersions.length; i++) {
                    if (versionHasContent(namedVersions[i])) {
                        versionsToShow.push(namedVersions[i])
                    }
                    if (versionMatchCur(namedVersions[i], cell)){
                        curMatch = namedVersions[i]
                        curIndex = versionsToShow.length - 1
                    }
                }
            }

            if (! curMatch){
                var d = {
                    name: '',
                    cell_id: cell.metadata.janus.id,
                    version_id: '',
                    content: cell.toJSON()
                }
                versionsToShow.push(d)
                curIndex = versionsToShow.length - 1;
            }

            versionsToShow = versionsToShow.reverse();
            curIndex = versionsToShow.length - 1 - curIndex;

            // set cell metadata to include all versions
            cell.metadata.janus.versions = versionsToShow;
            if (curIndex) {
                cell.metadata.janus.current_version = curIndex;
            }

            // append version markers
            var classes = "marker version"
            var num_versions = versionsToShow.length;
            if (num_versions > 0) {
                for (var v = 0; v < num_versions; v++) {

                    // append marker
                    newMarker = JanusUtils.addMarkerToElement(markerContainer, classes)

                    // assign colors
                    // TODO need to check if version matches what is in the cell
                    if (v == cell.metadata.janus.current_version){
                        newMarker.classList.add('selected-version')
                    } else {
                        newMarker.classList.remove('selected-version')
                    }

                    // render version name
                    if(versionsToShow[v].name){
                        newMarker.innerHTML = versionsToShow[v].name
                        newMarker.classList.add('named-version')
                    } else{
                        newMarker.classList.add('unnamed-version')
                    }

                    // add events
                    newMarker.onclick = createVersionClick(cell, v);
                    newMarker.ondblclick = function(){ enableVersionNameEditing(this)}
                    newMarker.onfocusout = function(){ disableVersionNameEditing(this, cell)}
                }
            }
        }

        renderExtraMarker(cell);
        updateMarkerVisibility(cell);
    }


    function versionHasContent(version){
        /* ensure this is not just an empty cell

        Args:
            version: version of cell to check
        */

        if (version['content']['source'] == "" && version['content']['outputs'].length == 0) {
            return false
        } else {
            return true
        }
    }


    function versionMatchCur(ver, cell){
        /* check if a version matches the current cell

        Args:
            ver: version of the cell to compare
            cell: cell to compare to
        */

        // do sources not match
        if (ver.content.source != cell.get_text()) {
            return false;
        }

        // do outputs not match?
        var verOut = ver.content.outputs;
        var cellOut = cell.output_area.outputs;

        if (verOut.length != cellOut.length) {
            return false;
        }

        for (var i = 0; i < verOut.length; i++) {
            if (verOut[i].output_type != cellOut[i].output_type) {
                return false
            }

            var outType = verOut[i].output_type
            if (outType == 'display_data'){
                if (verOut.data != cellOut.data) {
                    return false
                }
            }
            if (outType == 'execute_result'){
                if (verOut.data != cellOut.data) {
                    return false
                }
            }
            if (outType == 'stream'){
                if (verOut.text != cellOut.text) {
                    return false
                }
            }
            if (outType == 'error'){
                if (verOut.evaluate != cellOut.evaluate) {
                    return false
                }
            }
        }

        return true;
    }


    function initializeVersionMarkers() {
        /* create all markers based on metadata when notebook is opened */

        var cells = Jupyter.notebook.get_cells();
        for (var i = 0; i < cells.length; i++) {
            var cell = cells[i];
            if (cell instanceof CodeCell) {
                var markerContainer = JanusUtils.getMarkerContainer(cell)
                renderMarkers(cell);
                updateMarkerVisibility(cell);
            }
        }
    }


    function updateMarkerVisibility(cell) {
        /* hide / show all markers for this cell

        logic depends on if the cell is selected and if any versions are named

        Args:
            cell: cell to show / hide markers for
        */

        var janus_meta = cell.metadata.janus
        var input_area = cell.element.find('div.input_area')[0];
        var sum_marker = $(input_area).find(".summary")
        var named_markers = $(input_area).find(".named-version")
        var unnamed_markers = $(input_area).find(".unnamed-version")
        var output_markers = $(input_area).find(".hidden-output")
        var extra_markers = $(input_area).find(".extra")

        // start by hiding all markers
        $(input_area).find(".marker").hide();

        if (janus_meta.output_hidden){
            output_markers.show();
        }

        if (janus_meta.show_versions) {
            if (cell.selected) {
                if (cell.metadata.janus.all_versions_showing) {
                    named_markers.show();
                    if (unnamed_markers.length > 0){
                        unnamed_markers.show();
                        extra_markers.show();
                        extra_markers.removeClass('fa-ellipsis-h')
                        extra_markers.addClass('fa-angle-right')
                        extra_markers.css('padding-top', '')
                    }
                }
                else if (named_markers.length > 0) {
                    named_markers.show();
                    if (unnamed_markers.length > 0){
                        extra_markers.show();
                        extra_markers.removeClass('fa-angle-right')
                        extra_markers.addClass('fa-ellipsis-h')
                        extra_markers.css('padding-top', '0.25em')
                    }
                } else if (unnamed_markers.length > 3) {
                    unnamed_markers.slice(0,3).show()
                    extra_markers.show();
                    extra_markers.removeClass('fa-angle-right')
                    extra_markers.addClass('fa-ellipsis-h')
                    extra_markers.css('padding-top', '0.25em')
                } else {
                    unnamed_markers.show();
                }

            } else {
                if (named_markers.length > 0) {
                    named_markers.show();
                } else {
                    sum_marker.show();
                }
            }
        }
    }


    function enableVersionNameEditing(element) {
        /* let version marker div be edited to name version

        Args:
            element: element of marker that will be edited for naming
        */

        element.contentEditable = true;
        element.focus()
        Jupyter.notebook.keyboard_manager.edit_mode();
    }


    function disableVersionNameEditing(element, cell) {
        /* stop editing version name and save to metadata

        Args:
            element: marker user just clicked out of
            cell: cell whose versions are being edited
        */

        // get the cell
        var named_versions = cell.metadata.janus.named_versions
        var cur_index = cell.metadata.janus.current_version
        var cur_version = cell.metadata.janus.versions[cur_index]
        var version_id = cur_version.version_id
        var new_name = element.innerHTML

        // set the name in the cell's metadata
        cur_version.name = new_name;

        // determine if newly named version is already in our named version list
        var namedVersionsIds = named_versions.map(function(a) { return a.version_id; });
        var named_index = namedVersionsIds.indexOf(version_id)

        // if the version now has no name, remove from our list
        if(new_name == ""){
            element.classList.remove('named-version')
            element.classList.add('unnamed-version')
            if (named_index > -1) {
                named_versions.splice(named_index, 1)
                renderMarkers(cell);
                updateMarkerVisibility(cell);
            }
        } else {
            element.classList.add('named-version')
            element.classList.remove('unnamed-version')
            if (named_index == -1) {
                named_versions.push(cur_version)
                named_versions[named_versions.length - 1].name = new_name
                renderMarkers(cell);
                updateMarkerVisibility(cell);
            } else {
                named_versions[named_index].name = new_name
            }
        }
    }


    return {
        initializeVersionMarkers: initializeVersionMarkers,
        renderMarkers: renderMarkers,
        toggleCellVersions: toggleCellVersions,
        updateMarkerVisibility: updateMarkerVisibility,
        changeVersion: changeVersion
    };

});
