/*
Janus: Jupyter Notebook Extension that assist with notebook cleaning
*/

define([
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/events',
    'base/js/utils',
    'notebook/js/codecell',
    'notebook/js/textcell'
], function(
    require,
    $,
    Jupyter,
    events,
    utils,
    CodeCell,
    TextCell
){

    //TODO float Sidebar container to the right side of the interface
    //TODO render basic cell in the notebook inside Sidebar container
    //TODO enable cells to be flagged for hiding
    //TODO render hidden cells in sidebar when cell above them clicked
    // may have issues with accessing cells if cell above is deleted
    // or with moving cells in the main notebook around "hidden" ones
    //TODO render marker of how many hidden cells
    //TODO render more informative marker of hidden cells (e.g., minimap)

    // create 2nd notebook that is typeset version of the first
    var Sidebar = function(nb){
        var sidebar = this;
        this.notebook = nb;
        this.collapsed = true;

        // create html elements for sidebar and buttons
        this.element = $('<div id=sidebar-container>');
        this.close_button = $("<i>").addClass("fa fa-caret-square-o-right sidebar-btn sidebar-close");
        this.open_button = $("<i>").addClass("fa fa-caret-square-o-left sidebar-btn sidebar-open");
        this.element.append(this.close_button);
        this.element.append(this.open_button);

        // hook up events to buttons
        this.open_button.click(function () {
            sidebar.expand();
            sidebar.typeset(this.notebook);
        });
        this.close_button.click(function () {
            sidebar.collapse();
            $('#cell-wrapper').remove();
        });

        // render a copy of every cell

        // finally, add the Sidebar the page
        $("#notebook").append(this.element);

    };

    Sidebar.prototype.typeset = function(){
        // clear cell wrapper
        $('#cell-wrapper').remove();
        this.element.append($("<div/>").attr('id', 'cell-wrapper').addClass('cell-wrapper'));

        // get all cells currently in the notebook
        cells = Jupyter.notebook.get_cells()

        // create a new cell in the Sidebar with the same content
        for (i = 0; i < cells.length; i++){
            if(cells[i].cell_type == 'markdown'){
                // create new markdown cells
                newCell = new TextCell.MarkdownCell({
                    events: this.notebook.events,
                    config: this.notebook.config,
                    keyboard_manager: this.notebook.keyboard_manager,
                    notebook: this.notebook,
                    tooltip: this.notebook.tooltip,
                });

                cell_data = cells[i].toJSON();

                newCell.fromJSON(cell_data);

                // add markdown cell to the Sidebar
                $('#cell-wrapper').append(newCell.element);
            }
        }
    }

    Sidebar.prototype.toggle = function(){
        if(this.collapsed){
            this.expand();
        }
        else{
            this.collapse();
        }
        return false;
    };

    // TODO I think we may want this to come up from the bottom of the notebook
    Sidebar.prototype.expand = function(){
        this.collapsed = false;

        var site_height = $("#site").height();
        var site_width = $("#site").width();
        var notebook_width = $("#notebook-container").width();
        var sidebar_width = (site_width - 45) / 2

        $("#notebook-container").animate({
            marginLeft: '15px',
            width: sidebar_width
        }, 400)

        this.element.animate({
            right: '15px',
            width: sidebar_width
        }, 400)

        this.open_button.hide();
        this.close_button.show();
    };

    Sidebar.prototype.collapse = function(){
        this.collapsed = true;

        var menubar_width = $("#menubar-container").width();
        var site_width = $("#site").width();
        var margin = (site_width - menubar_width) / 2

        $("#notebook-container").animate({
            marginLeft: margin,
            width: menubar_width
        }, 400, function(){
            $("#notebook-container").css(
                'margin-left', 'auto'
            )
            $("#notebook-container").css(
                'width', ''
            )
        })



        this.element.animate({
            right: '15px',
            width: 0
        }, 250);

        this.close_button.hide();
        this.open_button.show();
    };

    function load_css() {
        // Load css for sidebar
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = require.toUrl("./main.css");
        document.getElementsByTagName("head")[0].appendChild(link);
    };

    function setupSidebar(){
        // only create sidebar if kernel is running
        if(Jupyter.notebook.kernel){
            createSidebar();
        }
        else{
            events.on('kernel_ready.Kernel', createSidebar);
        }
    }

    function createSidebar() {
        return new Sidebar(Jupyter.notebook);
      }

    function load_extension(){
        /* Called as extension loads and notebook opens */
        console.log('[Janus] is working');
        load_css()
        setupSidebar()
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
