# Janus
Janus is a Jupyter Notebook extension designed to help you organize your notebooks.
Janus tracks all changes to your notebook and lets you *hide cells* so you don't
have to scroll as much and can focus on a few cells at a time.

![Janus](http://adamrule.com/files/img/janus.gif)

## Installation
As is standard with [Jupyter Notebook extensions](http://jupyter-notebook.readthedocs.io/en/stable/examples/Notebook/Distributing%20Jupyter%20Extensions%20as%20Python%20Packages.html), to install Janus you need to first install the
extension's python package, and then install and enable both the server and
the client (i.e. nbextension) sides of the extension.

If you have already cloned this repository onto your machine, you should be
able to navigate to the top level "Janus" folder (with `setup.py` in it) and run
the following commands:

```shell
pip install ./ # can add --user if you only want to install for the current user
jupyter nbextension install --py janus
jupyter nbextension enable --py janus
jupyter serverextension enable --py janus
```

Note that Janus is still in alpha, so you may encounter bugs. If you would 
like to disable Janus, run the following commands:


```
jupyter nbextension disable --py janus
jupyter serverextension disable --py janus
```
