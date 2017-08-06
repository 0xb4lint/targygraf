<?php

namespace App;

class CourseBlock extends Model
{
    public $timestamps  = false;
    protected $table    = 'course_blocks';



    public function courses()
    {
        return $this->hasMany(Course::class);
    }
}
