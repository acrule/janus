/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
hiding cells and tracking changes
*/

define([
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/dialog',
    'base/js/utils'
], function(
    require,
    $,
    Jupyter,
    dialog,
    utils
){

    function createCommentModal() {
        /* show the comment modal */

        // create HTML for the modal's content
        var modal_body = $('<div/>');
        var commentArea = $('<div/ id="comment-area">');
        commentArea.append('<input id="comment-box" type="text" placeholder="Your comment..">')

        var pastComments = $('<div id="past-comments"/>')
        modal_body.append(commentArea);
        modal_body.append(pastComments);

        // create the modal
        var mod = dialog.modal({
            title: 'Leave a Comment',
            body: modal_body,
            default_button: null,
            buttons: { 'Save': {
                click: function () {

                    // post url
                    var baseUrl = Jupyter.notebook.base_url;
                    var nbUrl =  Jupyter.notebook.notebook_path;
                    var url = utils.url_path_join(baseUrl, 'api/janus', nbUrl);

                    // Post data
                    var d = JSON.stringify({
                        time: Date.now(),
                        comment: $('#comment-box').val(),
                        type: 'comment'
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
            } },
            notebook: Jupyter.notebook,
            keyboard_manager: Jupyter.notebook.keyboard_manager,
        });

        // When the modal opens, populate it with previous comments
        mod.on("shown.bs.modal", function () {

            // focus the comment bar
            setTimeout( function (){
                $("#comment-box").focus();
            }, 50)

            // populate with past comments
            var baseUrl = Jupyter.notebook.base_url;
            var nbUrl =  Jupyter.notebook.notebook_path;
            var url = utils.url_path_join(baseUrl, 'api/janus', nbUrl);

            var settings = {
                type : 'GET',
                data: {
                    q: 'comment',
                    path: '',
                    start: 0,
                    end: 0
                },
            };

            // show the modal window only after we have all our data ready
            utils.promising_ajax(url, settings).then( function(value) {
                var d = JSON.parse(value);
                var c = d['comments'].reverse();

                for (var i = 0; i < c.length; i++) {
                    var par = $('<p/>').text(c[i][1])
                    $('#past-comments').append(par)
                }
            });

        })
    }

    return{
        createCommentModal: createCommentModal
    }

});
