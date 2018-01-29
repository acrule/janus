# Janus
Janus is a Jupyter Notebook extension that helps users keep clean notebooks. It
tracks all changes to the notebook and lets users *fold cells* so their
notebooks can provide a summary of their work with details-on-demand. Together
these history and summarization features enable users to keep a short notebook
without losing the full context of their work.

![Janus](/img/janus.gif)

## Installation
To install a [Jupyter Notebook extension](http://jupyter-notebook.readthedocs.io/en/stable/examples/Notebook/Distributing%20Jupyter%20Extensions%20as%20Python%20Packages.html), you need to first install the extension, which is
formatted as a python package, and then install and enable both the server and
the client (i.e. nbextension) sides of the extension.

If you have already cloned this repository onto your machine, you should be
able to navigate to the top level "Janus" folder (with `setup.py` in it) and run the following commands

```
pip install -e ./ --user
jupyter nbextension install --py janus
jupyter nbextension enable --py janus
jupyter serverextension enable --py janus
```
