/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes
*/

define([
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/dialog',
    'base/js/utils',
    'notebook/js/cell',
    'notebook/js/codecell',
    'notebook/js/textcell',
    '../janus/janus_history'
], function(
    require,
    $,
    Jupyter,
    dialog,
    utils,
    Cell,
    CodeCell,
    TextCell,
    JanusHistory
){

    // TODO Pull cell history from database, not metadata
    // TODO default cell history slider to n - 1 version
    // TODO debug saving of cell versions before cell fully executed
    // TODO debug history dialog window overflowing the main screen
    // TODO fix "hidden cell" to be grey text "folded cell"
    // TODO enable cell folding in history viewer

    var HistoryModal = function(nb){
        var historyViewer = this;

        Jupyter.historyViewer = historyViewer;

        this.notebook = nb;
        this.getNBConfigs()
    }

    HistoryModal.prototype.showModal = function(){

        // get the number of versions from the database
        // this.getNBConfigs();
        num_configs = this.nb_configs.length
        that = this

        var modal_body = $('<div/>');
        var revision = $('<div id="revision"/>')
        revision.append($('<div id="rev_num"/>'));
        revision.append($('<div id="rev_time"/>'));
        modal_body.append(revision);



        var slide = modal_body.append($('<div id="modal-slide"/>').slider({
            min: 0,
            max: num_configs - 1,
            value: num_configs - 1,
            step: 1,
            orientation: "horizontal",
            range: "min",
            slide: function( event, ui ){
                that.updateModal(ui.value);
            }
        }));

        var history_cell_wrapper  = modal_body.append($("<div/>")
            .attr('id', 'history-cell-wrapper')
            .addClass('cell-wrapper'));

        var mod = dialog.modal({
            title: 'Notebook History',
            body: modal_body,
            buttons: { 'OK': {} }
        })

        mod.on("shown.bs.modal", function () {
            that.updateModal(num_configs - 1)
        })
    }

    HistoryModal.prototype.getNBConfigs = function(){
        // compose url to POST to
        that = this;
        var baseUrl = Jupyter.notebook.base_url;
        var notebookUrl =  Jupyter.notebook.notebook_path;
        var url = utils.url_path_join(baseUrl, 'api/janus', notebookUrl);
        var paths = Jupyter.notebook.metadata.filepaths;
        this.nb_configs = []

        for(var i=0; i<paths.length; i++){
            // prepare POST settings
            var settings = {
                type : 'GET',
                data: {
                    q: 'config',
                    path: paths[i][0],
                    start: paths[i][1],
                    end: paths[i][2]
                },
            };

            if(i == paths.length - 1){
                // send the POST request
                utils.promising_ajax(url, settings).then(function(value, i){
                    get_data = JSON.parse(value)
                    that.nb_configs = that.nb_configs.concat(get_data['nb_configs']);
                    that.showModal();
                });
            }
            else{
                // send the POST request
                utils.promising_ajax(url, settings).then(function(value, i){
                    get_data = JSON.parse(value)
                    that.nb_configs = that.nb_configs.concat(get_data['nb_configs']);
                });
            }
        }
    }

    HistoryModal.prototype.getVersions = function(version_ids){
        // compose url to POST to
        that = this;
        var baseUrl = Jupyter.notebook.base_url;
        var notebookUrl =  Jupyter.notebook.notebook_path;
        var url = utils.url_path_join(baseUrl, 'api/janus', notebookUrl);
        var paths = Jupyter.notebook.metadata.filepaths;

        // prepare POST settings
        var settings = {
            type : 'GET',
            data: {
                q: 'versions',
                version_ids: version_ids
            },
        };

        // send the POST request, then check if filename has changed
        utils.promising_ajax(url, settings).then(function(value){
            get_data = JSON.parse(value)
            that.cells = get_data['cells'];

            version_ids = eval(version_ids)

            // remove and replace wrapper
            $('#history-cell-wrapper').empty()

            for (i=0; i<version_ids.length; i++){
                if (version_ids[i] in that.cells){
                    that.appendCell(that.cells[version_ids[i]])
                }
            }
        });
    }

    HistoryModal.prototype.appendCell = function(cell){

        newCell = null

        // markdown cells
        if(cell.cell_type == 'markdown'){
            newCell = new TextCell.MarkdownCell({
                events: this.notebook.events,
                config: this.notebook.config,
                keyboard_manager: this.notebook.keyboard_manager,
                notebook: this.notebook,
                tooltip: this.notebook.tooltip,
            });
        }
        // code cells
        else if(cell.cell_type == 'code'){
            newCell = new CodeCell.CodeCell(this.notebook.kernel, {
                events: this.notebook.events,
                config: this.notebook.config,
                keyboard_manager: this.notebook.keyboard_manager,
                notebook: this.notebook,
                tooltip: this.notebook.tooltip,
            });
        }
        else if (cell.cell_type = 'raw'){
            newCell = new TextCell.RawCell({
                events: this.notebook.events,
                config: this.notebook.config,
                keyboard_manager: this.notebook.keyboard_manager,
                notebook: this.notebook,
                tooltip: this.notebook.tooltip,
            });
        }

        // populate sidebar cell with content of notebook cell
        // cell_data = cell.toJSON();
        newCell.fromJSON(cell);
        newCell.code_mirror.setOption('readOnly', "nocursor")


        // add new cell to the sidebar
        $('#history-cell-wrapper').append(newCell.element);
        // this.cells.push(newCell);

        // make sure all code cells are rendered
        if(newCell.cell_type == 'code'){
            newCell.render();
            newCell.focus_editor();
        }
    }

    HistoryModal.prototype.updateModal = function(version_num){
        t = parseInt( this.nb_configs[version_num][0] )
        t_now = Date.now()
        t_diff = (t_now - t) / 1000
        rev_string = (version_num + 1).toString() + " of " + this.nb_configs.length.toString()
        date_string = ""

        if (t_diff < 3600){
            num_min = parseInt(t_diff / 60)
            date_string = num_min.toString() + " min ago"
        }
        else if (t_diff < 86400){
            num_hours = parseInt(t_diff / 3600)
            date_string = num_hours.toString() + " hours ago"
        }
        else{
            num_days = parseInt(t_diff / 86400)
            date_string = num_days.toString() + " days ago"
        }

        $('#rev_num').html(rev_string)
        $('#rev_time').html(date_string)


        version_ids = this.nb_configs[version_num][3]
        this.getVersions(version_ids)
    }

    function createHistoryModal() {
        /* create a new sidebar element */
        return new HistoryModal(Jupyter.notebook);
    }

    return{
        createHistoryModal: createHistoryModal
    };

})
