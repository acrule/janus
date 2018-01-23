"""
Janus: Jupyter Notebook extension that helps users keep clean notebooks by 
folding cells and keeping track of all changes
"""

from distutils.core import setup

setup(
    name='janus',
    version='0.1',
    description='Jupyter Notebook extension that helps users keep clean notebooks by folding cells and keeping track of all changes',
    author='Adam Rule',
    author_email='acrule@ucsd.edu',
    license='BSD-3-Clause',
    packages=['janus'],
    package_dir={'janus': 'janus'},
    package_data={'janus': ['static/*.js', 'static/*.css']}
)
