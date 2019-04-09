Requires `Node V10 <https://nodejs.org/en/download/>`_ or later. To install:

::

	$ git clone git@github.com:dbrnz/mapmaker
	$ cd mapmaker
	$ npm install

A simple map:
::

    $ ./mapmaker maps/circle/mapmaker.json output/circle

A larger flatmap of the body. This will take a while to build (6+ minutes on a fast Macbook Pro).
::

    $ ./mapmaker maps/body/mapmaker.json output/body
