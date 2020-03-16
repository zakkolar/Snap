# Snap<em>!</em> Microworlds

A Microworld is a Snap<em>!</em> interface that hides away some parts of the UI,
takes away a bunch functionalities and limits the palette to a restricted amount
of blocks. In other words, it is a way to create Parsons problems in
Snap<em>!</em>.

This is a research project and the features described in this document are, so
far, only aimed at EDC's *math+c* project. That is to say, there may be several
combinations of parameters that don't play well together and result in a not
very functional microworld. The only combinations we have thoroughly tested are
the ones that the *math+c* project uses.

## Defining a Microworld

Microworlds are described in XML, inside a `microworld` tag at the end of a
regular project file. Like this:

```
<project>
...
  <microworld>
  ...
  </microworld>
</project>
```

Scroll to the bottom of this document for a complete example, or check out this
one in your browser:

* [Example add-subtract microworld](http://microworld.edc.org#open:example.xml)

### Attributes

The `microworld` tag accepts the following attributes:

* **zoom** *[number]*: defines the block scale. 
* **enableKeyboard** *[boolean]*: toggles keyboard editing (using keyboard to
enter blocks.)
* **enterOnLoad** *[boolean]*: defines whether the microworld should be entered
immediately after loading the project or not.
* **simpleBlockDialog** *[boolean]*: toggles a very simplified version of the
block editor where only one category and input type is available.

### Tags

The `microworld` tag accepts the following embedded tags:

* `<customJS>`: any JS written inside this tag is going to run every time the
microworld is entered. The `this` pseudovariable points to the IDE.
* `<hiddenMorphs>`: a comma-separated list of selectors that define parts of
the UI that are going to be hidden. The complete list of supported selectors is:
  - `spriteBar`: the sprite properties bar, where you can define its name and
rotation style, and where the *Scripts, Costumes* and *Sounds* tabs live.
  - `spriteCorral`: the area under the *Stage*, where you can see and select
all the sprites in your project, as well as create new ones.
  - `categoryList`: the area on top of the palette, where you can switch
between block categories.
  - `makeBlockBUttons`: all *Make a block* buttons in the palette. Note that
this doesn't hide the *make a block...* option in the scripting area context
menu.
  - `searchButton`: the magnifying glass icon at the top of the blocks
palette.
  - `steppingButton`: the button that lets you go into (and change the speed
of) single stepping mode.
  - `startButton`: the green flag button.
  - `pauseButton`: the pause button, next to the green flag one.
* `<blockSpecs>`: a comma-separated list of *specs* (or *selectors*, for
primitive blocks) of the *only* blocks that you want the microworld to show to
users. These will all be combined into a single category. Check out the *Finding
out block specs and selectors* section for more details. To include vertical
spaces into the palette just add a hyphen into the list, also separated by
commas.
* `<projectMenu>`: a comma-separated list of the *only* items that you want
the project menu to have. These items are described by their exact wording in
English, so take special care of including punctuation (ex. *Open...*). To
define a separator between two items, just add a *0* into the list, also
separated by commas.
* `<blockContextMenu>`: a comma-separated list of the *only* items that you
want the block context menu to have. That is the menu that pops up when you
right-click on a block. The item to duplicate just the block under your cursor
has no text content, since it displays the image of the block itself. To refer
to this one you need to write `[object HTMLCanvasElement]`. To define a
separator between two items, just add a *0* into the list, also separated by
commas.
* `<buttons>`: a list of `<button>` tags that describe custom buttons to be
placed at the top right of the scripting area. Refer to the *Custom buttons*
section for details.


### Finding out block specs and selectors

The spec of a custom block is just its label text, where each parameter is
enclosed by single quotes and preceded by a percent sign, like this:

```
  walk %'steps' steps forward
```

To find out the selector of a primitive block, you need to first go into dev
mode by shift-clicking on the Snap<em>!</em> logo at the top left of the UI and
selecting *Switch to dev mode*.

Once in dev mode, right click on the block of which you want to know the spec.
A menu will pop up showing you all morphs under your cursor. One of them is
going to be a *[Something]BlockMorph*. That's the one you need.

Navigate into its submenu and click on *inspect*. This will open a Morphic
inspector on this block, where you can navigate through all of its innards.
Search for *selector* in the left column, and click on it. The panel at the top
of the right column will show you this block's selector.

### Custom buttons

A button is defined with a `<button>` tag. The tag accepts one single attribute,
`label` that describes the button's label text. Like this:

```
<button label="Help">
```

The content of the button tag is an arbitrary snippet of Javascript. The `this`
pseudovariable points to the sprite that owns the scripting area.

Here's an example of a button that broadcasts a message:

```
<button label="Help">
  var ide = this.parentThatIsA(IDE_Morph);
  ide.broadcast("help");
</button>
```

Here's another example of a button that makes the sprite move 10 steps:

```
<button label="Walk!">
  this.forward(10);
</button>
```

## Entering and escaping a MicroWorld

When loading a microworld project, right-click on the Snap<em>!</em> icon at the
top left of the UI and select *Enter microworld* or *Escape microworld*,
depending on whether you're in it or not.

To have a microworld enter automatically on load, you can use the *enterOnLoad*
attribute, as described in the *Attributes* section.

## Full microworld example

```
<project name=(...)>
(...)
  <microworld
    zoom="1.5"
    enableKeyboard="false"
    enterOnLoad="true"
    simpleBlockDialog="true"
  >
    <customJS>
      console.log('Entering Microworld.');
      this.broadcast("start");
    </customJS>
    <hiddenMorphs>spriteBar,spriteCorral,categoryList,makeBlockButtons,searchButton,steppingButton,startButton,pauseButton</hiddenMorphs>
    <blockSpecs>forward,turn,clear,down,up,doRepeat</blockSpecs>
    <projectMenu>New,Open...,Save,Save As...,0,Export project...,Export blocks...</projectMenu>
    <blockContextMenu>help...,delete block definition...,edit...,0,duplicate,[object HTMLCanvasElement]</blockContextMenu>
    <buttons>
      <button label="Help">
        this.bubble("Use the blocks in the palette to draw a square");
      </button>
    </buttons>
  </microworld>
</project>
```
