/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
hiding cells and tracking changes
*/

define([
    'require',
    'jquery',
    'base/js/namespace',
    'notebook/js/cell',
    'notebook/js/codecell',
    'notebook/js/textcell',
    '../janus/versions',
    '../janus/utils'
], function(
    require,
    $,
    Jupyter,
    Cell,
    CodeCell,
    TextCell,
    JanusVersions,
    JanusUtils
){

    var Sidebar = function(nb) {
        /* A sidebar panel for showing groups of hidden cells

        Args:
            nb: the jupyter notebook instance
        */

        var sidebar = this;
        Jupyter.sidebar = sidebar;

        sidebar.notebook = nb;
        sidebar.collapsed = true;
        sidebar.cells = []
        sidebar.sections = []
        sidebar.positionTimer = null

        // create html element for sidebar and add to page
        sidebar.element = $('<div id=sidebar-container>');
        $("#notebook").append(sidebar.element);

        return this;
    };


    Sidebar.prototype.toggle = function() {
        /* Toggle showing the sidebar */

        if (this.collapsed) {
            this.expand()
        } else {
            this.collapse()
        }
    }


    Sidebar.prototype.expand = function() {
        /* Show sidebar expanding from left of page */

        // only proceed if sidebar is currently collapsed
        if(! this.collapsed){
            return;
        }

        var that = this;
        this.collapsed = false;

        var site_height = $("#site").height();
        var site_width = $("#site").width();
        // 15 pixel gutter + 15 pixel padding on each side of page
        var sidebar_width = (site_width - 45) / 2;

        // move the notebook container to the side
        $("#notebook-container").animate({
            marginLeft: '15px',
            width: sidebar_width
        }, 400);

        //  move the sidebar into position
        Jupyter.sidebar.element.animate({
            right: '15px',
            width: sidebar_width,
            top: 20,
            padding: '0px'
        }, 400, function (){

            //TODO replace by iterating over sections and their cells
            // we should not have to keep a separate list of sidebar cells
            for (i=0; i<that.cells.length; i++){
                if (that.cells[i].cell_type == 'code') {
                    that.cells[i].render();
                    that.cells[i].focus_editor();
                    that.cells[i].expand_output();
                }
            }

            Jupyter.notebook.get_selected_cell().element.focus()
        })
    };


    Sidebar.prototype.collapse = function() {
        /* Collapse the sidebar to the right page border */

        // only proceed if sidebar is currently expanded
        if (this.collapsed) {
            return;
        }

        var that = this;
        this.collapsed = true;

        var menubar_width = $("#menubar-container").width();
        var site_width = $("#site").width();
        var margin = (site_width - menubar_width) / 2

        // need to use exact values for animation, then return to css defaults
        $("#notebook-container").animate({
            marginLeft: margin,
            width: menubar_width
            }, 400, function(){
                $("#notebook-container").css( 'margin-left', 'auto' )
                $("#notebook-container").css( 'width', '' )
        })

        // hide the sidebar
        this.element.animate({
            right: '15px',
            width: 0,
            padding: '0px'
        }, 400, function() {

            // hide all sections
            $('.section').hide();
            for (var i=0; i< that.sections.length; i++){
                that.sections[i].showing = false;
            }
        });
    };


    var Section = function( marker = null ) {
        /* A group of contiguous cells to be shown in the sidebar */

        var section = this;

        //TODO pass marker to constructor to link this and the marker
        section.cells = []
        section.marker = marker;

        section.element = $('<div class=section>');
        $("#notebook").append(section.element);

        return this;
    }


    Section.prototype.renderCells = function(cells, title = "") {
        /* render notebook cells in the section

        Args:
            cells: list of cell objects from the main notebook
        */

        var that = this;

        // remove any cells currently in section
        this.cells = []

        // add header
        var header = $("<div/>").addClass('section-header')
        var closeContainer = $("<div/>").addClass('section-close')
            .append($("<i>")
            .addClass("fa fa-angle-left section-close-button")
            .click( function(){
                that.close();
            })
        )
        header.append(closeContainer)
        header.append($("<div/>").addClass('section-title').text(title))
        this.element.append(header)

        // add cell wrapper
        $(this.element).find('.section-cell-wrapper').remove();
        var cellWrapper = $("<div/>")
            .addClass('section-cell-wrapper')
            .addClass('cell-wrapper')
        this.element.append(cellWrapper);

        // for each cell, create a new cell in the Sidebar with the same content
        for (var i = 0; i < cells.length; i++) {

            // add new cell to the sidebar
            newCell = this.createSectionCell(cells[i]);
            cellWrapper.append(newCell.element);
            this.cells.push(newCell);

            // for now, add sell to sidebar list too
            Jupyter.sidebar.cells.push(newCell);


            // make sure all code cells are rendered
            if (newCell.cell_type == 'code') {
                newCell.render();
                newCell.focus_editor();
                newCell.expand_output();
            }

            // hide output if needed
            if (newCell.metadata.janus.source_hidden && ! newCell.metadata.janus.output_hidden) {
                newCell.element.find("div.output_wrapper").hide();
            }

            if (newCell.metadata.janus.output_hidden && !newCell.metadata.janus.source_hidden) {
                newCell.element.find("div.input").hide();
            }

            // intercept sidebar click events and apply them to original cell
            newCell._on_click = function(event) {

                // select the appropriate cell in the original notebook
                this.events.trigger('select.Cell', {
                    'cell': this.nb_cell,
                    'extendSelection':event.shiftKey
                });
            }

            // propigate edits in sidebar cell to main notebook cell
            newCell.code_mirror.on('change', function(){
                if(newCell.nb_cell){
                    newCell.nb_cell.set_text( newCell.get_text() )
                }
            });

            // render any history markers
            JanusVersions.renderMarkers(newCell);
        }

        // focus the first cell in the sidebar
        if(cells.length > 0){
            cells[0].sb_cell.element.focus();
            if(cells[0].cell_type == 'code'){
                cells[0].sb_cell.focus_editor();
            }
        }

        var selCell = Jupyter.notebook.get_selected_cell()
        selCell.element.focus()
        selCell.focus_cell()
        if(selCell.cell_type == 'code'){
            selCell.focus_editor();
        }

    }


    Section.prototype.createSectionCell = function(cell) {
        /* Create sidebar cell duplicating a cell in the main notebook

        Args:
            cell: a single cell object from the main notebook
        */

        var cellJSON = cell.toJSON();
        var newCell = JanusUtils.getDuplicateCell(cellJSON, Jupyter.notebook)

        // link the notebook and sidebar cells
        newCell.nb_cell = cell;
        cell.sb_cell = newCell;

        return newCell;
    }


    Section.prototype.close = function() {
        /* Delete a section from the sidebar */

        // hide this element
        this.element.hide()
        this.showing = false;
        $(this.marker).removeClass('active')

        Jupyter.sidebar.saveMarkerMetadata()

        // collapse sidebar if this was the last visible section
        var allClosed = true;

        for (var i = 0; i < Jupyter.sidebar.sections.length; i++) {
            if (Jupyter.sidebar.sections[i].showing == true) {
                allClosed = false;
            }
        }
        if (allClosed) {
            Jupyter.sidebar.collapse()
        }

        Jupyter.sidebar.startRepositionTimer()

    }


    Sidebar.prototype.updateHiddenCells = function (){
        /* Update cells in the notebook and the sidebar */

        this.updateHiddenCellsNotebook()
        this.updateSidebarSections()
    }


    Sidebar.prototype.updateHiddenCellsNotebook = function() {

        // get the current configuration of the cells
        // save data from and remove current markers for hidden cells
        $(".hide-container").remove()

        var cells = Jupyter.notebook.get_cells();
        var serial_hidden_cells = []
        var serial_lines = 0

        for (var i = 0; i < cells.length; i++) {

            // keep track of groups of hidden cells
            var cellHidden = cells[i].metadata.janus.cell_hidden
            if (cellHidden) {
                serial_hidden_cells.push(cells[i])

                // count lines of code
                if (cells[i].cell_type == "code") {
                    var lines_of_code = cells[i].get_text().split('\n').length
                    if (lines_of_code > 0) {
                        serial_lines = serial_lines + lines_of_code
                    }
                }
            }

            // create placeholder if at last cell, or at visible cell after
            // a group of hidden cells
            var numHidden = serial_hidden_cells.length
            if ( i == cells.length - 1 && cellHidden || (! cellHidden && numHidden > 0) ){

                var cell_ids = []
                for (var j = 0; j < numHidden; j++) {
                    serial_hidden_cells[j].element.addClass('hidden');
                    cell_ids.push(serial_hidden_cells[j].metadata.janus.id);
                }

                // create placeholder that will render this group of hidden cells
                Jupyter.sidebar.addPlaceholderAfterElementWithIds(serial_hidden_cells[numHidden - 1].element, cell_ids, serial_lines)

                // clear our lists
                serial_hidden_cells = []
                serial_lines = 0
            }
        }

        //TODO may not need this here
        Jupyter.sidebar.saveMarkerMetadata()

    }


    Sidebar.prototype.updateSidebarSections = function() {
        /* update the sections shown in the sidebar */

        // copy old section array
        var oldSections = []

        if (Jupyter.sidebar.sections){
            oldSections = Jupyter.sidebar.sections.slice();
        }
        var newSections = [];
        var markers = $('.hide-marker, .hidden-output, .hidden-code').toArray();

        // get a list of just the cell ids shown in each marker
        var oldSectionIDs = []
        for (var i=0; i < oldSections.length; i++ ){

            // use to track if this section has been matched
            oldSections[i].found = false;

            // get list of cell ids for each section
            var ids = [];
            for (var j = 0; j < oldSections[i].cells.length; j++) {
                ids.push(oldSections[i].cells[j].metadata.janus.id)
            }
            oldSectionIDs.push(ids)
        }

        // look for old sections that stayed the same (i.e. are showing the same cells)
        for (var i = 0; i < markers.length; i++) {

            var markerIDs = $(markers[i]).data('ids');
            var sectionIndex = $(markers[i]).data('sectionIndex');
            var matchID = matchIDs(markerIDs, sectionIndex, oldSectionIDs);

            // reuse an exisitng section
            if (matchID >= 0) {

                // track that this section has been found
                oldSections[matchID].found = true;
                var newSection = oldSections[matchID]

                // update the marker in this section
                newSection.marker = markers[i];
                var newSectionIndex = newSections.length
                $(markers[i]).data('sectionIndex', newSectionIndex)

                // add the section to our list
                newSections.push(newSection)

            // or create a new section if needed
            } else {

                // first get a list of the cells to copy
                var cells = Jupyter.notebook.get_cells()
                var cells_to_copy = []
                for (var j = 0; j < cells.length; j++) {
                    if ( $.inArray( cells[j].metadata.janus.id, markerIDs ) > -1 ){
                        cells_to_copy.push(cells[j])
                    }
                }

                // assign the correct title
                var title = ""
                var title_labels = $(markers[i]).find('.hide-label')
                if (title_labels.length > 0){
                    var title = title_labels[0].innerHTML
                }

                //TODO later we will want to append in the right spot on the list
                // then create the section
                var newSection = createSection(markers[i])
                var sb = Jupyter.sidebar;
                $(sb.element).append(newSection.element);
                newSection.renderCells(cells_to_copy, title)

                // add this to our list of sections
                var newSectionIndex = newSections.length
                $(markers[i]).data('sectionIndex', newSectionIndex)
                newSections.push(newSection)
            }
        }

        // get rid of old sections that no longer have a match
        for (var i = 0; i < oldSections.length; i ++ ){
            if (oldSections[i].found == false) {
                oldSections[i].element.hide()
                oldSections[i].element.remove()
            }
        }

        // save any metadata for future reference
        Jupyter.sidebar.saveMarkerMetadata()

        // show / hide all sections
        Jupyter.sidebar.sections = newSections
        var anyShowing = false
        for (var i = 0; i < newSections.length; i ++){
            if (newSections[i].showing){
                anyShowing = true;
                newSections[i].element.show()
                $(newSections[i].marker).addClass('active')
            } else {
                newSections[i].element.hide()
                $(newSections[i].marker).removeClass('active')
            }
        }

        // and open or close the sidebar if needed
        if (anyShowing) {
            Jupyter.sidebar.expand()
        } else {
            Jupyter.sidebar.collapse()
        }

        Jupyter.sidebar.startRepositionTimer()

    }


    function matchIDs(markerIDs, sectionIndex, oldSectionIDs) {
        /* Find a match for the ids */

        if (oldSectionIDs.length == 0){
            return -1
        }

        if (JSON.stringify(markerIDs) == JSON.stringify(oldSectionIDs[sectionIndex])) {
            return sectionIndex
        } else {
            for (var i = 0; i < oldSectionIDs.length; i ++) {
                if (JSON.stringify(markerIDs) == JSON.stringify(oldSectionIDs[i])) {
                    return i;
                }
            }
            return -1
        }
    }


    Sidebar.prototype.startRepositionTimer = function () {
        /* Ensure we don't reposition many times in a row since cell.select
            seems to get called very frequently by background processes */

        clearTimeout(Jupyter.sidebar.positionTimer)
        Jupyter.sidebar.positionTimer = setTimeout(this.repositionSections, 150);
    }


    Sidebar.prototype.repositionSections = function (initialPos = false){
        /* Reposition the sidebar sections based on what is currently selected */

        // get cell visibility metadata
        var selCell = Jupyter.notebook.get_selected_cell()
        var selCellID = selCell.metadata.janus.id
        var selCellHidden = selCell.metadata.janus.cell_hidden
        var selOutHidden = selCell.metadata.janus.output_hidden
        var selSourceHidden = selCell.metadata.janus.source_hidden

        // get sidebar section visibility metadata
        var marker = null;
        if (selCellHidden) {
            var marker = $(selCell.element).nextAll('.hide-container').find('.hide-marker').first()
        } else if (selOutHidden) {
            var marker = $(selCell.element).find('.hidden-output').first()
        } else if (selSourceHidden) {
            var marker = $(selCell.element).find('.hidden-code').first()
        }
        var showing = null;
        var selSection = null;
        if (marker) {
            var selSection = $(marker).data('sectionIndex')
            var showing = Jupyter.sidebar.sections[selSection].showing
        }

        // if hidden cell is selected and associated section is showing, set
        // position starting with selected section
        if ((selCellHidden || selOutHidden || selSourceHidden) && showing) {

            if (selSection < 0){
                return
            }

            // set position of selected section
            var sect = Jupyter.sidebar.sections[selSection].element
            var marker = Jupyter.sidebar.sections[selSection].marker
            var prevTop = null
            var prevEnd = null
            if (showing) {
                var yPos = getYPos(marker)
                var that = sect;
                $(sect).animate({ top: yPos}, 250);
                $(sect).show(0).delay(250);
                prevTop = yPos;
                prevEnd = yPos + $(sect).outerHeight();
            }

            // set position of previous sections
            if (selSection > 0){
                for (var i = selSection - 1; i >= 0; i--){
                    var sect = Jupyter.sidebar.sections[i].element
                    var marker = Jupyter.sidebar.sections[i].marker
                    var showing = Jupyter.sidebar.sections[i].showing
                    if (! showing) {
                        continue
                    }
                    var yPos = getYPos(marker)
                    if (prevTop){
                        yPos = Math.min(prevTop - $(sect).outerHeight() - 15, yPos)
                    }
                    var that = sect;
                    $(sect).animate({ top: yPos}, 250);
                    $(sect).show(0).delay(250);
                    prevTop = yPos;
                }
            }

            // set position of following sections
            if (selSection < Jupyter.sidebar.sections.length - 1){
                for (var i = selSection + 1; i < Jupyter.sidebar.sections.length; i++){
                    var sect = Jupyter.sidebar.sections[i].element
                    var marker = Jupyter.sidebar.sections[i].marker
                    var showing = Jupyter.sidebar.sections[i].showing
                    if (! showing) {
                        continue
                    }
                    var yPos = getYPos(marker)
                    if (prevEnd){
                        yPos = Math.max(prevEnd + 15, yPos)
                    }
                    var that = sect;
                    $(sect).animate({ top: yPos}, 250);
                    $(sect).show(0).delay(250);
                    prevEnd = yPos + $(sect).outerHeight();
                }
            }

        } else {
            var prevEnd = null;
            for (var i = 0; i < Jupyter.sidebar.sections.length; i++) {
                var sect = Jupyter.sidebar.sections[i].element
                var marker = Jupyter.sidebar.sections[i].marker
                var showing = Jupyter.sidebar.sections[i].showing
                if (! showing) {
                    continue
                }
                var yPos = getYPos(marker)
                if (prevEnd){
                    yPos = Math.max(prevEnd + 15, yPos)
                }
                var that = sect;
                $(sect).animate({ top: yPos}, 250);
                $(sect).show(0).delay(250);
                prevEnd = yPos + $(sect).outerHeight();
            }
        }
    }


    function getYPos(marker) {
        /* Get the y position of a marker relative to the notebook  */

        if ($(marker).hasClass('hide-marker')) {
            return $(marker).closest('.hide-container').position().top - 24
        } else if ($(marker).hasClass('hidden-code')) {
            return $(marker).closest('.cell').position().top - 24
        } else if ($(marker).hasClass('hidden-output')) {
            return $(marker).closest('.cell').position().top - 24
        } else {
            return 0
        }
    }


// PLACEHOLDERS FOR HIDDEN CELLS
    Sidebar.prototype.addPlaceholderAfterElementWithIds = function(elem, cell_ids, serial_lines) {
        /* Add the placeholder used to open a group of hidden cells */

        // get placholder name and showing status from metadata, if present
        var markerMetadata = Jupyter.notebook.metadata.janus.janus_markers;
        var first_stored = '';
        var first_showing = false
        if (markerMetadata) {
            for (var j = 0; j < markerMetadata.length; j++) {
                overlap = markerMetadata[j].ids.filter((n) => cell_ids.includes(n))
                if(overlap.length > 0){
                    var first_stored = markerMetadata[j].markerName
                    // var first_showing = markerMetadata[j].showing
                    break
                }
            }
        }

        var place = elem.after($('<div>')
            .addClass('hide-container')
            .append($('<div>')
                .addClass('hide-spacer'))
            .append($('<div>')
                .addClass('hide-marker')
                .data('ids', cell_ids.slice())
                .click(function(event){
                    $('#minimap').remove()
                    var that = this;
                    var sectionIndex = $(this).data('sectionIndex')
                    Jupyter.sidebar.sections[sectionIndex].showing = true;
                    $(this).addClass('active')
                    var secIndex = $(this).data('sectionIndex');
                    Jupyter.sidebar.sections[sectionIndex].element.show();
                    Jupyter.sidebar.expand()
                    Jupyter.sidebar.saveMarkerMetadata()

                    // select the first cell in the sidebar section
                    var firstCell = Jupyter.sidebar.sections[secIndex].cells[0]
                    firstCell.events.trigger('select.Cell', {
                        'cell': firstCell.nb_cell,
                        'extendSelection':event.shiftKey
                    });
                })
                .hover(function(event){
                    JanusUtils.showMinimap(event, this)
                },
                function(event){
                    JanusUtils.hideMinimap(event, this)
                })
                .mousemove( function(event){
                    JanusUtils.moveMinimap(event, this);
                }
                )
                .append($('<div>')
                    .addClass('hide-label')
                    .click(function(event){
                        enableVersionNameEditing(this)
                        event.stopPropagation()
                    })
                    .focusout(function(){
                        disableVersionNameEditing(this)
                    })
                    .hover(function(event){
                        this.style.color = "#333"
                        this.style.background = "#DDD"
                    },
                    function(event){
                        this.style.color = ""
                        this.style.background = ""
                    })
                    .text(function(){
                        if(first_stored == "" || first_stored == "Hidden Cells"){
                            return "Hidden Cells"
                        }
                        else{
                            return first_stored
                        }
                    })
                    // TODO intercept "Enter" to unselect, rather than start new line
                )
                .append($('<div>')
                    .addClass('hide-text')
                    .text(serial_lines +  " lines")
                    .append($('<div>')
                        .addClass('fa fa-angle-right hide-arrow')))
                )
            )
    }


    Sidebar.prototype.saveMarkerMetadata = function() {
        /* Store marker names to notebook metadata for later use */

        var hideMarkers = $('.hide-marker', 'hidden-code', 'hidden-output').toArray()
        var hideMetadata = []
        for (i = 0; i < hideMarkers.length; i++) {
            var markerIDs = $(hideMarkers[i]).data('ids')
            var markerName = $(hideMarkers[i]).find('.hide-label')[0].innerHTML
            var sectionIndex = $(hideMarkers[i]).data('sectionIndex')
            var showing = false
            if (sectionIndex) {
                var showing = Jupyter.sidebar.sections[sectionIndex].showing
            }
            hideMetadata.push({
                'ids': markerIDs,
                'markerName': markerName,
                'showing': showing
            })
        }
        Jupyter.notebook.metadata.janus.janus_markers = hideMetadata
    }


    function highlightMarker(marker) {
        /*  highlight the marker clicked to show the sidebar
        marker: dom element, or null */

        $('.hide-marker').removeClass('active')
        $('.hidden-code').removeClass('active')
        $('.hidden-output').removeClass('active')
        if(marker != null){
            $(marker).addClass('active')
        }
    }


    function enableVersionNameEditing(element) {
        /* let version marker div be edited to name version

        Args:
            element: placeholder element to enable naming on
        */

        element.contentEditable = true;
        element.focus()
        Jupyter.notebook.keyboard_manager.edit_mode();
    }


    function disableVersionNameEditing(element) {
        /* stop editing version name and save to metadata

        Args:
            element: placeholder to get name from
        */

        element.contentEditable = false;
        Jupyter.notebook.keyboard_manager.command_mode();
        if(element.innerHTML == "" || element.innerHTML == "Hidden Cells"){
            element.innerHTML = "Hidden Cells"
        }
        Jupyter.sidebar.saveMarkerMetadata()

    }


    function createSidebar() {
        /* create a new sidebar element */

        return new Sidebar(Jupyter.notebook);
    }


    function createSection(marker = null) {

        return new Section(marker);
    }


    return{
        createSidebar: createSidebar
    };

});
