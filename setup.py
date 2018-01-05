"""
Janus: Jupyter Notebook Extension that assist with notebook cleaning
"""

from distutils.core import setup

setup(
    name='janus',
    version='0.1',
    description='Jupyter Notebook Extension that helps with notebook cleaning',
    author='Adam Rule',
    author_email='acrule@ucsd.edu',
    license='BSD-3-Clause',
    packages=['janus'],
    package_dir={'janus': 'janus'},
    package_data={'janus': ['static/*.js']}
)
