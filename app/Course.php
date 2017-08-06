<?php

namespace App;

use Illuminate\Database\Eloquent\SoftDeletes;

class Course extends Model
{
    use SoftDeletes;

    protected $table = 'courses';



    public function prerequisites()
    {
        return $this->belongsToMany(
            self::class,
            'prerequisites',
            'course_id',
            'prerequisite_course_id'
        )
        ->withPivot('is_parallel');
    }



    public function courseBlockReferences()
    {
        return $this->belongsToMany(
            CourseBlock::class,
            'course_reference_course_block'
        );
    }
}
