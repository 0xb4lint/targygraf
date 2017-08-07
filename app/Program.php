<?php

namespace App;

class Program extends Model
{
    public $timestamps  = false;
    protected $table    = 'programs';



    public function courseBlocks()
    {
        return $this->hasMany(CourseBlock::class)
            ->orderBy('is_semester', 'DESC')
            ->orderBy('ordering');
    }



    public function getRouteKeyName()
    {
        return 'slug';
    }
}
