/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes
*/

define([
    'require',
    'jquery',
    'base/js/events',
    'base/js/utils',
    'base/js/namespace',
    'notebook/js/codecell'
],function(
    require,
    $,
    events,
    utils,
    Jupyter,
    codecell
){

    // reference for later use
    var CodeCell = codecell.CodeCell;

// MARKER CLICK EVENTS
    function change_version(cell, v){
        /* Change which cell version is shown */

        var input_area = cell.element.find('div.input_area')[0];
        var markers = input_area.getElementsByClassName('version')
        var versions = cell.metadata.janus.versions

        // update cell metadata
        cell.metadata.janus.current_version = v;

        // update cell input and output
        cell.set_text(versions[v]['content']['source']);
        cell.output_area.clear_output()
        for (var i = 0; i < versions[v]['content']['outputs'].length; i++){
            cell.output_area.append_output(versions[v]['content']['outputs'][i]);
        }

        // highlight marker for selected version
        for (var i = 0; i < markers.length; i++){
            if (i == v){ markers[i].classList.add('selected-version') }
            else{ markers[i].classList.remove('selected-version') }
        }
    }

    function createVersionClick(cell, v, element){
        /* Attach function to version marker click events */
        return function() {
            janus_meta = cell.metadata.janus
            change_version(cell, v);
            if((janus_meta.cell_hidden || janus_meta.source_hidden)
                && ! Jupyter.sidebar.collapsed && cell.nb_cell){
                change_version(cell.nb_cell, janus_meta.current_version)
            }
        }
    }

    function toggleCellVersions() {
        cell = Jupyter.notebook.get_selected_cell();
        cell.metadata.janus.track_versions = ! cell.metadata.janus.track_versions;

        /* Set message and update menu-items when tracking turned on / off */
       var message = 'Showing Cell Versions';
       if (cell.metadata.janus.track_versions) {
           message = 'Hiding Cell Versions';
       }
       Jupyter.notification_area.widget('notebook').set_message(message, 2000)

       render_markers(cell);
       hide_markers(cell);
    }

// RENDERING Functions
    //TODO limit cell history search based on paths
    function getCellVersions(cell){
        /* get every version of this cell from the database */

        var baseUrl = Jupyter.notebook.base_url;
        var notebookUrl =  Jupyter.notebook.notebook_path;
        var url = utils.url_path_join(baseUrl, 'api/janus', notebookUrl);

        var paths = Jupyter.notebook.metadata.filepaths;
        var cell_id = cell.metadata.janus.id
        var cell_versions = []

        for ( var i=0; i<paths.length; i++ ) {

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

            // combine results of all queries together before showing markers
            if(i == paths.length - 1){
                // send the POST request
                utils.promising_ajax(url, settings).then(function(value, i){
                    get_data = JSON.parse(value)
                    cell_versions = cell_versions.concat(get_data['versions']);
                    render_version_markers(cell, cell_versions)
                    // render_summary_marker(cell, cell_versions);
                });
            }
            else{
                // send the POST request
                utils.promising_ajax(url, settings).then(function(value, i){
                    get_data = JSON.parse(value)
                    cell_versions = cell_versions.concat(get_data['versions']);
                });
            }
        }
    }

    function render_summary_marker(cell){
        /* create a summary marker for cell history versions */
        // if(cell_versions.length > 0){
        var input_area = cell.element.find('div.input_area')[0];
        // var num_versions = cell_versions.length
        // var showing = cell.metadata.janus.versions_showing

        // clear current summary marker
        var markers = input_area.getElementsByClassName('summary')
        while(markers[0]){
            markers[0].parentNode.removeChild(markers[0]);
        }

        // change styling and add events to the marker
        var newElement = document.createElement('div');
        newElement.className = "marker summary fa fa-code-fork"
        // newElement.onclick = createSummaryClick(newElement, cell);

        marker_container = $(input_area).find('.marker-container')[0]
        if(marker_container){
            marker_container.appendChild(newElement);
        }
        else{
            var markerContainer = document.createElement('div')
            markerContainer.className = "marker-container"

            // prepare for absolute positioning of marker
            input_area.style.position = "relative";
            input_area.appendChild(markerContainer);

            marker_container = $(input_area).find('.marker-container')[0]
            marker_container.appendChild(newElement);
        }
    }

    // TODO update to use version markers
    function render_version_markers(cell, cell_versions){
        /* render markers for each saved cell version */
        if(cell_versions.length > 0){

            // enusre proper metadata
            if (cell.metadata.janus.named_versions == undefined) {
                cell.metadata.janus.named_versions = [];
            }

            // combine list of queried and already named versions
            var cellVersionIds = cell_versions.map(function(a) {return a.version_id;});
            var namedVersions = cell.metadata.janus.named_versions;
            var namedVersionsIds = namedVersions.map(function(a) {return a.version_id;});
            var versionsToShow = []

            // clear current markers
            var input_area = cell.element.find('div.input_area')[0];
            var markers = input_area.getElementsByClassName('version');
            while(markers[0]){
                markers[0].parentNode.removeChild(markers[0]);
            }

            // if (! cell.selected && namedVersions.length == 0 ) {
            //     render_summary_marker(cell, cell_versions);
            //     return
            // }

            if (namedVersions.length > 0) {
                for (i=0; i < namedVersions.length; i++) {
                    versionsToShow.push(namedVersions[i])
                }
            }

            if( cell_versions.length > 0 ){
                for ( j = 0; j < cell_versions.length; j++ ){
                    if (namedVersionsIds.indexOf(cell_versions[j].version_id ) == -1) {
                        versionsToShow.push(cell_versions[j])
                    }
                }
            }

            var num_versions = versionsToShow.length;
            // var showing = cell.metadata.janus.versions_showing;

            cell.metadata.janus.versions = versionsToShow

            if( num_versions > 0){

                // prepare for absolute positioning of markers
                input_area.style.position = "relative";

                // render new ones
                for (var v = 0; v < num_versions; v++) {
                    var newElement = document.createElement('div');
                    newElement.className = "marker version";

                    // assign colors
                    // TODO need to check if version matches what is in the cell
                    if (v == cell.metadata.janus.current_version){
                        newElement.classList.add('selected-version')
                    } else {
                        newElement.classList.remove('selected-version')
                    }

                    // render version name
                    if(versionsToShow[v].name){
                        newElement.innerHTML = versionsToShow[v].name
                        newElement.classList.add('named-version')
                    } else{
                        newElement.classList.add('unnamed-version')
                    }

                    // events
                    newElement.onclick = createVersionClick(cell, v, newElement);
                    newElement.ondblclick = function(){ enableVersionNameEditing(this)}
                    newElement.onfocusout = function(){ disableVersionNameEditing(this, cell)}

                    // append marker
                    if($(input_area).find('.marker-container')[0]){
                        $(input_area).find('.marker-container')[0].appendChild(newElement);
                    }

                    else{
                        var input_area = cell.element.find('div.input_area')[0];
                        var markerContainer = document.createElement('div')

                        // prepare for absolute positioning of marker
                        input_area.style.position = "relative";

                        markerContainer.className = "marker-container"
                        input_area.appendChild(markerContainer);

                        $(input_area).find('.marker-container')[0].appendChild(newElement);
                    }
                }
            }
        }

        hide_markers(cell);
    }

    function render_markers(cell){
        /* show version and summary markers */

        // make sure the showing variable has a value before we call renderers
        if (cell.metadata.janus.versions_showing === undefined){
            cell.metadata.janus.versions_showing = false;
        }
        if (cell.metadata.janus.track_versions === undefined){
            cell.metadata.janus.track_versions = false;
        }

        // only show markers if the flag is set
        if (cell.metadata.janus.track_versions) {
            render_summary_marker(cell);
            getCellVersions(cell);
        }
    }

    function initialize_markers(){
        /* create all markers based on metadata when notebook is opened */

        var cells = Jupyter.notebook.get_cells();
        for ( var i = 0; i < cells.length; i++ ) {
            var cell = cells[i];
            if ( cell instanceof CodeCell ) {

                var input_area = cell.element.find('div.input_area')[0];
                var markerContainer = document.createElement('div')

                // prepare for absolute positioning of marker
                input_area.style.position = "relative";
                markerContainer.className = "marker-container"
                input_area.appendChild(markerContainer);

                render_markers(cell);
                hide_markers(cell);
            }
        }
    }

    function hide_markers(cell){
        /* hide all markers for this cell */

        var janus_meta = cell.metadata.janus
        var input_area = cell.element.find('div.input_area')[0];
        var sum_marker = $(input_area).find(".summary")
        var named_markers = $(input_area).find(".named-version")
        var unnamed_markers = $(input_area).find(".unnamed-version")

        // start by hiding all markers
        $(input_area).find(".marker").hide();

        // show just the
        if ( janus_meta.track_versions ) {
            if ( cell.selected ){
                named_markers.show();
                unnamed_markers.show();
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
        /* let version marker div be edited to name version */

        element.contentEditable = true;
        element.focus()
        Jupyter.notebook.keyboard_manager.edit_mode();
    }

    function disableVersionNameEditing(element, cell) {
        /* stop editing version name and save to metadata */


        // get the cell
        var named_versions = cell.metadata.janus.named_versions
        var cur_index = cell.metadata.janus.current_version
        var cur_version = cell.metadata.janus.versions[cur_index]
        var version_id = cur_version.version_id
        var new_name = element.innerHTML

        cur_version.name = new_name;

        // determine if newly named version is already in our named version list
        var namedVersionsIds = named_versions.map(function(a) { return a.version_id; });
        var named_index = namedVersionsIds.indexOf(version_id)

        // if it now has no name, remove from our list
        if(new_name == ""){
            element.classList.remove('named-version')
            element.classList.add('unnamed-version')
            if (named_index > -1){
                named_versions.splice(named_index, 1)
                render_markers(cell);
                hide_markers(cell);
            }
        }
        // if if now has a name, either update its entry, or add to our list
        else{
            element.classList.add('named-version')
            element.classList.remove('unnamed-version')
            if (named_index == -1){
                named_versions.push(cur_version)
                named_versions[named_versions.length - 1].name = new_name
                render_markers(cell);
                hide_markers(cell);
            }
            else{
                named_versions[named_index].name = new_name
            }
        }
    }

// PATCH FUNCTIONS

    function patch_CodeCell_execute() {
        /* re-render version markers after each execution */

		var old_execute = CodeCell.prototype.execute;
        CodeCell.prototype.execute = function () {
            old_execute.apply(this, arguments);
            // check_version(this);
            render_markers(this);
		}
    }

    function patch_CodeCell_select() {
        /* show version markers when cell is selected, and update sidebar */

		var old_select = CodeCell.prototype.select;
        CodeCell.prototype.select = function() {

            old_select.apply(this, arguments);
            hide_markers(this);

            // update sidebar
            janus_meta = this.metadata.janus
            if ( (janus_meta.cell_hidden || janus_meta.source_hidden)
                && ! Jupyter.sidebar.collapsed && this.sb_cell) {
                this.sb_cell.select();
                hide_markers(this.sb_cell);
            }
		}
    }

    function patch_CodeCell_unselect(){
        /* hide cell version markers when cell is unselected */

		var old_unselect = CodeCell.prototype.unselect;
        CodeCell.prototype.unselect = function() {
            old_unselect.apply(this, arguments);
            hide_markers(this);

            // update sidebar
            janus_meta = this.metadata.janus
            if((janus_meta.cell_hidden || janus_meta.source_hidden)
                    && ! Jupyter.sidebar.collapsed && this.sb_cell){
                hide_markers(this.sb_cell)
            }
		}

    }

    function patch_keydown(){
        /* enable keyboard shortcuts to edit cell history */

        document.onkeydown = function(e) {
            var cell = Jupyter.notebook.get_selected_cell();
            var hidden_cell = false;

            // if operating on a hidden cell, make changes to sidebar cell first
            if ((cell.metadata.janus.cell_hidden || cell.metadata.janus.source_hidden)
                    && ! Jupyter.sidebar.collapsed && cell.sb_cell){
                hidden_cell = true;
                cell = cell.sb_cell
            }

            var expanded = cell.metadata.janus.versions_showing
            var versions = cell.metadata.janus.versions
            var curIndex = cell.metadata.janus.current_version

            if (Jupyter.notebook.keyboard_manager.mode == "command" ) { // if not editing cell and versions are showing
                if (e.keyCode == 37) { // left

                    if ( curIndex > 0 ) {
                        var newIndex = curIndex - 1;
                        change_version(cell, newIndex);

                        // update the main cell notebook too
                        if (hidden_cell) {
                            change_version(cell.nb_cell, newIndex)
                        }
                    }
                } else if (e.keyCode == 39) { // right

                    if ( curIndex < versions.length - 1 ) {
                        var newIndex = curIndex + 1;
                        change_version(cell, newIndex)

                        // update the main cell notebook too
                        if(hidden_cell){
                            change_version(cell.nb_cell, newIndex)
                        }
                    }
                }
            }
        }
    }

    function load_cell_history(){
        /* patch functions needed to manage cell histories */

        patch_CodeCell_execute();
        patch_CodeCell_select();
        patch_CodeCell_unselect();
        patch_keydown();

        // wait till notebook is loaded to do anything with cells
        if (typeof Jupyter.notebook === "undefined") {
            events.on("notebook_loaded.Notebook", initialize_markers);
        } else {
            initialize_markers();
        }
    }

    return {
        load_cell_history: load_cell_history,
        render_markers: render_markers,
        toggleCellVersions: toggleCellVersions
    };

});
