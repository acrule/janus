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

    // create 2nd notebook that is typeset version of the first
    var Article = function(nb){
        var article = this;
        this.notebook = nb;
        this.collapsed = true;

        // create html elements
        this.element = $('<div id = article>');
        this.close_button = $("<i>").addClass("fa fa-caret-square-o-right article-btn article-close");
        this.open_button = $("<i>").addClass("fa fa-caret-square-o-left article-btn article-open");
        this.element.append(this.close_button);
        this.element.append(this.open_button);

        // hook up events to buttons
        this.open_button.click(function () {
            article.expand();
            article.typeset(this.notebook);
        });
        this.close_button.click(function () {
            article.collapse();
        });

        // render a copy of every cell

        // finally, add the Article the page
        $("#menubar-container").append(this.element);

    };

    Article.prototype.typeset = function(){
        // clear cell wrapper
        $('#cell-wrapper').remove();
        this.element.append($("<div/>").attr('id', 'cell-wrapper').addClass('cell-wrapper'));

        // get all cells currently in the notebook
        cells = Jupyter.notebook.get_cells()

        // create a new cell in the Article with the same content
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

                // add markdown cell to the Article
                $('#cell-wrapper').append(newCell.element);
            }
        }
    }

    Article.prototype.toggle = function(){
        if(this.collapsed){ this.expand(); }
        else{ this.collapse(); }
        return false;
    };

    // TODO I think we may want this to come up from the bottom of the notebook
    Article.prototype.expand = function(){
        this.collapsed = false;
        var site_height = $("#site").height();
        this.element.animate({
            height: site_height
        }, 400)
        this.open_button.hide();
        this.close_button.show();
    };

    Article.prototype.collapse = function(){
        this.collapsed = true;
        this.element.animate({
            height: 0,
        }, 250);
        this.close_button.hide();
        this.open_button.show();
    };

    function load_css() {
        // Load css for article
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = require.toUrl("./main.css");
        document.getElementsByTagName("head")[0].appendChild(link);
    };

    function setupArticle(){
        // only create article if kernel is running
        if(Jupyter.notebook.kernel){
            createArticle();
        }
        else{
            events.on('kernel_ready.Kernel', createArticle);
        }
    }

    function createArticle() {
        return new Article(Jupyter.notebook);
      }

    function load_extension(){
        /* Called as extension loads and notebook opens */
        console.log('[Janus] is working');
        load_css()
        setupArticle()
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
